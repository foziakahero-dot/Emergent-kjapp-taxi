#!/usr/bin/env python3
"""Create a QA superadmin user in the database.

SECURITY REQUIREMENTS:
- NEVER output credentials to stdout, stderr, deployment logs, or job logs
- Require explicit APP_ENV=qa and VERIFIED QA database identity (connect + check isolation markers)
- Operator provides password via secure stdin (TTY getpass ONLY) — NEVER in env/argv/logs, NEVER via pipe
- Preserve mandatory Superadmin 2FA requirements (totp_enabled=false initially)
- Script is CLI-only, unavailable through public HTTP endpoints

RENDER EXECUTION (SECURE SECRET HANDLING):
- Use interactive ephemeral SSH: render ssh srv-db61otlckfvc73bqp480 --ephemeral
- Password entered via getpass() on TTY stdin — no echo, no history, no process table, no logs
- NEVER in: CLI arguments, environment variables, stdout/stderr, deployment logs, Git, chat

Run on Render QA:
  # Interactive (REQUIRED):
  render ssh srv-db61otlckfvc73bqp480 --ephemeral
  python backend/scripts/create_qa_superadmin.py
  # Enter password at prompt (getpass, no echo)

Or locally with QA database credentials:
  APP_ENV=qa MONGO_URL="mongodb://..." DB_NAME="snar_qa" python backend/scripts/create_qa_superadmin.py
  # Enter password at prompt (getpass, no echo)
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
import asyncio


def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets minimum security requirements."""
    if len(password) < 16:
        return False, "Password must be at least 16 characters"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    if not re.search(r"[!@#$%^&*]", password):
        return False, "Password must contain at least one special character (!@#$%^&*)"
    return True, "OK"


def get_operator_password() -> str:
    """
    Get password from operator via secure stdin (TTY getpass ONLY).
    NEVER use CLI arguments, environment variables, or stdin pipe.
    Fail closed without a TTY.
    """
    import sys

    # ONLY TTY interactive (secure for manual execution)
    if sys.stdin.isatty():
        import getpass
        return getpass.getpass("Enter QA superadmin password (16+ chars, upper, lower, digit, special): ").strip()

    # No TTY - fail closed. No stdin pipe, no env var fallback.
    return ""


def verify_qa_environment_config() -> tuple[bool, str]:
    """
    Verify QA environment configuration from environment variables.
    Fail closed on missing, ambiguous, or mismatched configuration.
    """
    app_env = os.environ.get("APP_ENV", "").strip().lower()
    if app_env != "qa":
        return False, f"APP_ENV must be exactly 'qa', got '{app_env}'"

    db_name = os.environ.get("DB_NAME", "").strip()
    if not db_name:
        return False, "DB_NAME is required"

    # Verify DB_NAME matches QA pattern: contains 'qa' as separate word
    # Pattern: (?:^|[_-])qa(?:$|[_-]) - matches snar_qa, qa_db, db-qa, etc.
    if not re.search(r"(?:^|[_-])qa(?:$|[_-])", db_name.lower()):
        return False, f"DB_NAME '{db_name}' does not match QA database pattern (must contain 'qa' as separate word)"

    mongo_url = os.environ.get("MONGO_URL", "").strip()
    if not mongo_url:
        return False, "MONGO_URL is required"

    # Verify MONGO_URL does not contain production indicators
    if re.search(r"(prod|production)", mongo_url, re.IGNORECASE):
        return False, "MONGO_URL appears to reference production environment"

    return True, "OK"


async def verify_qa_database_identity(db, db_name: str) -> tuple[bool, str]:
    """
    Connect to database and verify it is the approved isolated QA MongoDB target.
    Checks isolation markers that only exist in the approved QA database.
    Fail closed on any verification failure.

    NOTE: The backend /ready endpoint computes qa_database_isolated and qa_mode
    dynamically from APP_ENV and DB_NAME - they are NOT stored in platform_settings.
    This verification uses independently verifiable markers:
    1. Database name matches expected QA database (from env)
    2. No production data markers exist (excluding known QA bootstrap account)
    3. MongoDB cluster identity verified via hello command against pre-approved QA Atlas host allowlist
    """
    try:
        # 1. Verify database name matches expected QA database
        if db.name != db_name:
            return False, f"Connected database name '{db.name}' does not match DB_NAME '{db_name}'"

        # 2. Verify platform_settings singleton exists (database initialized by backend)
        settings = await db.platform_settings.find_one({"_id": "singleton"})
        if not settings:
            return False, "platform_settings singleton not found - database not initialized by QA backend"

        # 3. Verify no production data markers (excluding the known QA bootstrap superadmin)
        # Use $and to correctly combine regex and $ne - duplicate "email" keys would silently fail
        prod_domains = ["snarapp.no", "kjappapp.no"]
        qa_superadmin_email = "qa-superadmin@snarapp.no"
        for domain in prod_domains:
            count = await db.users.count_documents({
                "$and": [
                    {"email": {"$regex": f"@{re.escape(domain)}$"}},
                    {"email": {"$ne": qa_superadmin_email}}
                ]
            })
            if count > 0:
                return False, f"Database contains {count} '{domain}' email accounts (excluding qa-superadmin) - not isolated QA"

        # 4. Verify MongoDB cluster identity against pre-approved QA cluster identifiers
        # This is MANDATORY - fail closed if QA_CLUSTER_IDENTIFIERS is not configured
        # or if the connected cluster's identity does not match any approved identifier
        cluster_verified, cluster_msg = await _verify_mongodb_cluster_identity(db.client)
        if not cluster_verified:
            return False, cluster_msg

        return True, "OK"

    except Exception as e:
        return False, f"Database identity verification failed: {e}"


async def _verify_mongodb_cluster_identity(client: AsyncIOMotorClient) -> tuple[bool, str]:
    """
    Verify the MongoDB cluster identity using Atlas-compatible methods.

    Uses the MongoDB 'hello' command (modern replacement for 'ismaster') to obtain
    server metadata, combined with an independently approved QA Atlas connection-host
    allowlist from the QA_ATLAS_HOSTS environment variable.

    This approach works on all MongoDB deployments including Atlas M0/Flex tiers
    where replSetGetStatus is not available.

    QA_ATLAS_HOSTS environment variable must contain a comma-separated list of
    approved Atlas host patterns (e.g., "snar-qa.6acc27266b2b9c24df70b88c.mongodb.net").
    Patterns support wildcards for shard members (e.g., "snar-qa-shard-*.mongodb.net").

    Fail closed if:
    - QA_ATLAS_HOSTS is not set
    - Cannot determine connected host(s) from hello command or connection string
    - Connected host(s) do not match any approved pattern
    - hello command fails (indicating connection/permission issues)
    """
    # Get pre-approved QA Atlas host allowlist from environment
    # Must distinguish between "not set" and "set but empty" for clear error messages
    if "QA_ATLAS_HOSTS" not in os.environ:
        return False, (
            "QA_ATLAS_HOSTS environment variable not set. "
            "Must provide comma-separated list of pre-approved QA Atlas host patterns "
            "(e.g., 'snar-qa.6acc27266b2b9c24df70b88c.mongodb.net'). "
            "Cannot verify QA database identity without approved Atlas hosts."
        )

    approved_hosts_env = os.environ.get("QA_ATLAS_HOSTS", "").strip()
    approved_patterns = [p.strip() for p in approved_hosts_env.split(",") if p.strip()]
    if not approved_patterns:
        return False, "QA_ATLAS_HOSTS is set but contains no valid host patterns"

    try:
        admin_db = client.admin

        # Use hello command (modern, works on all MongoDB versions including Atlas M0)
        # hello returns: hosts (list of replica set members), primary, me, setName, etc.
        hello_result = await admin_db.command("hello")

        # Extract host information from hello response
        # 'hosts' contains the replica set member host:port strings
        # 'me' contains this server's host:port
        # 'primary' contains the primary's host:port (if available)
        hello_hosts = hello_result.get("hosts", [])
        hello_me = hello_result.get("me", "")
        hello_primary = hello_result.get("primary", "")
        hello_set_name = hello_result.get("setName", "")

        # Collect all unique hosts from hello response
        connected_hosts = set()
        for host_entry in hello_hosts:
            # host_entry format: "host:port"
            host = host_entry.split(":")[0] if ":" in host_entry else host_entry
            connected_hosts.add(host.lower())
        if hello_me:
            me_host = hello_me.split(":")[0] if ":" in hello_me else hello_me
            connected_hosts.add(me_host.lower())
        if hello_primary:
            primary_host = hello_primary.split(":")[0] if ":" in hello_primary else hello_primary
            connected_hosts.add(primary_host.lower())

        if not connected_hosts:
            # Fallback: try to extract host from client's connection string
            # This is less reliable but provides defense-in-depth
            return False, "hello command returned no host information - cannot verify cluster identity"

        # Verify each connected host against approved patterns
        # We require ALL connected hosts to match at least one approved pattern
        # This prevents man-in-the-middle or unexpected cluster connections
        unmatched_hosts = []
        matched_hosts = []

        for host in connected_hosts:
            host_matched = False
            for pattern in approved_patterns:
                # Convert glob pattern to regex
                # * matches any characters (for Atlas hostnames with cluster ID subdomain)
                # Escape special regex chars, then convert * to .*
                regex_pattern = re.escape(pattern).replace(r"\*", ".*")
                if re.fullmatch(regex_pattern, host, re.IGNORECASE):
                    host_matched = True
                    matched_hosts.append(f"{host} (matched {pattern})")
                    break
            if not host_matched:
                unmatched_hosts.append(host)

        if unmatched_hosts:
            return False, (
                f"Connected MongoDB host(s) do not match approved QA Atlas hosts. "
                f"Unmatched: {', '.join(unmatched_hosts)}. "
                f"Matched: {', '.join(matched_hosts) if matched_hosts else 'none'}. "
                f"Approved patterns: {approved_patterns}"
            )

        # Additional verification: hello command succeeded and we're connected to a valid replica set
        # (hello_set_name will be empty for standalone, but Atlas is always replica set)
        identity_parts = []
        if hello_set_name:
            identity_parts.append(f"replica set: {hello_set_name}")
        if hello_primary:
            identity_parts.append(f"primary: {hello_primary}")
        if matched_hosts:
            identity_parts.append(f"verified hosts: {len(matched_hosts)}")

        return True, f"Cluster identity verified via hello command: {', '.join(identity_parts)}"

    except Exception as e:
        # hello command failure indicates connection issues or insufficient permissions
        return False, f"MongoDB hello command failed - cannot verify cluster identity: {e}"


async def main():
    # 1. Verify QA environment configuration - fail closed
    is_qa, msg = verify_qa_environment_config()
    if not is_qa:
        print(json.dumps({
            "status": "error",
            "error": f"QA environment verification failed: {msg}"
        }), file=sys.stderr)
        sys.exit(1)

    # 2. Require operator-provided password via secure stdin (TTY getpass ONLY)
    # This is NEVER generated by the script, NEVER output to logs, NEVER in CLI args
    temp_password = get_operator_password()
    if not temp_password:
        print(json.dumps({
            "status": "error",
            "error": "Password required. Provide via interactive TTY prompt only (getpass). "
                     "No stdin pipe, no environment variable. "
                     "Minimum 16 chars, uppercase, lowercase, digit, special char (!@#$%^&*)"
        }), file=sys.stderr)
        sys.exit(1)

    # 3. Validate password strength
    valid, msg = validate_password_strength(temp_password)
    if not valid:
        print(json.dumps({
            "status": "error",
            "error": f"Password does not meet requirements: {msg}"
        }), file=sys.stderr)
        sys.exit(1)

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")

    superadmin_email = "qa-superadmin@snarapp.no"
    superadmin_name = "QA Superadmin"

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # 4. Verify QA database identity by connecting and checking isolation markers
    db_verified, db_msg = await verify_qa_database_identity(db, db_name)
    if not db_verified:
        print(json.dumps({
            "status": "error",
            "error": f"QA database identity verification failed: {db_msg}"
        }), file=sys.stderr)
        sys.exit(1)

    # 5. Check if superadmin already exists - do NOT overwrite
    existing = await db.users.find_one({"email": superadmin_email, "role": "superadmin"})
    if existing:
        print(json.dumps({
            "status": "exists",
            "message": "Superadmin user already exists",
            "user_id": str(existing["_id"]),
            "email": superadmin_email
        }))
        return

    # 6. Hash password using bcrypt (matches backend/hash_password implementation)
    try:
        import bcrypt
        password_hash = bcrypt.hashpw(temp_password.encode(), bcrypt.gensalt()).decode()
    except ImportError:
        print(json.dumps({
            "status": "error",
            "error": "bcrypt not installed"
        }), file=sys.stderr)
        sys.exit(1)

    now = datetime.now(timezone.utc).isoformat()

    # 7. Create superadmin with mandatory security settings:
    # - must_reset_password: true (force password change on first login)
    # - totp_enabled: false (operator MUST enable 2FA via /auth/2fa/setup -> /auth/2fa/enable before admin access)
    # - approved: true, disabled: false
    superadmin_doc = {
        "email": superadmin_email,
        "fullName": superadmin_name,
        "phone": "",
        "role": "superadmin",
        "permissions": ["operations", "finance", "support", "communications", "system"],
        "password_hash": password_hash,
        "approved": True,
        "disabled": False,
        "must_reset_password": True,  # Force password change on first login
        "totp_enabled": False,        # 2FA required for admin access (enforced by _enforce_admin_2fa)
        "created_at": now,
        "legal_accepted": True,
        "legal_version": "2025-01-01",
    }

    try:
        result = await db.users.insert_one(superadmin_doc)
        # 8. Output ONLY non-sensitive confirmation to stdout (structured JSON)
        # NO credentials, NO password, NO database URI, NO secrets
        print(json.dumps({
            "status": "created",
            "user_id": str(result.inserted_id),
            "email": superadmin_email,
            "must_reset_password": True,
            "totp_enabled": False,
            "message": "Superadmin created. Operator must: 1) Login with provided password, "
                       "2) Change password (must_reset_password), "
                       "3) Enable 2FA via /auth/2fa/setup then /auth/2fa/enable, "
                       "4) Then admin endpoints will be accessible."
        }))
    except DuplicateKeyError:
        print(json.dumps({
            "status": "error",
            "error": "User with this email already exists (but may not be superadmin)"
        }), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "error": f"Failed to create superadmin: {e}"
        }), file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())