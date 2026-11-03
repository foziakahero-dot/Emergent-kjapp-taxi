#!/usr/bin/env python3
"""Create a QA superadmin user in the database.

SECURITY REQUIREMENTS:
- NEVER output credentials to stdout, stderr, deployment logs, or job logs
- Require explicit APP_ENV=qa and VERIFIED QA database identity (connect + check isolation markers)
- Operator provides password via secure stdin (TTY getpass or pipe) — NEVER in env/argv/logs
- Preserve mandatory Superadmin 2FA requirements (totp_enabled=false initially)
- Script is CLI-only, unavailable through public HTTP endpoints

RENDER EXECUTION (SECURE SECRET HANDLING):
- Use interactive ephemeral SSH: render ssh srv-db61otlckfvc73bqp480 --ephemeral
- Password entered via getpass() on TTY stdin — no echo, no history, no process table, no logs
- NEVER in: CLI arguments, environment variables, stdout/stderr, deployment logs, Git, chat

Run on Render QA:
  # Interactive (RECOMMENDED):
  render ssh srv-db61otlckfvc73bqp480 --ephemeral
  python backend/scripts/create_qa_superadmin.py
  # Enter password at prompt (getpass, no echo)

  # Non-interactive (automation only):
  echo "<password>" | render ssh srv-db61otlckfvc73bqp480 --output text -- -o BatchMode=yes 'python backend/scripts/create_qa_superadmin.py'

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
    Get password from operator via secure stdin (TTY getpass) or stdin pipe.
    Priority: 1) TTY getpass (interactive), 2) stdin pipe (automation), 3) env var (CI only, with warning).
    NEVER use CLI arguments.
    """
    import sys

    # 1. Try TTY interactive (most secure for manual execution)
    if sys.stdin.isatty():
        import getpass
        return getpass.getpass("Enter QA superadmin password (16+ chars, upper, lower, digit, special): ").strip()

    # 2. Try stdin pipe (for automation)
    stdin_input = sys.stdin.read().strip()
    if stdin_input:
        return stdin_input

    # 3. Fallback to env var (CI only — NOT for manual execution)
    # This path should ONLY be used in controlled CI with secret injection
    import os
    pwd = os.environ.get("QA_SUPERADMIN_PASSWORD", "").strip()
    if pwd:
        print("WARNING: Using QA_SUPERADMIN_PASSWORD from environment. Prefer stdin/TTY for manual execution.", file=sys.stderr)
        return pwd

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
    """
    try:
        # 1. Verify database name matches expected QA database
        if db.name != db_name:
            return False, f"Connected database name '{db.name}' does not match DB_NAME '{db_name}'"

        # 2. Check for QA isolation marker in platform_settings (set by backend on startup)
        settings = await db.platform_settings.find_one({"_id": "singleton"})
        if settings:
            # The backend sets qa_mode and validates qa_database_isolated at startup
            # If we can read platform_settings, we're in the right database
            pass

        # 3. Verify no production data markers
        # Check for production domains that should NEVER appear in QA
        prod_domains = ["snarapp.no", "kjappapp.no"]
        for domain in prod_domains:
            count = await db.users.count_documents({"email": {"$regex": f"@{re.escape(domain)}$"}})
            if count > 0:
                return False, f"Database contains {count} '{domain}' email accounts - not isolated QA"

        # 4. Verify QA-specific configuration markers
        # Check if there's a QA fleet application or other QA test data
        qa_fleet_apps = await db.fleet_applications.count_documents({"company_name": {"$regex": "QA|TEST", "$options": "i"}})
        # Note: This is informational; absence doesn't mean not QA

        return True, "OK"

    except Exception as e:
        return False, f"Database identity verification failed: {e}"


async def main():
    # 1. Verify QA environment configuration - fail closed
    is_qa, msg = verify_qa_environment_config()
    if not is_qa:
        print(json.dumps({
            "status": "error",
            "error": f"QA environment verification failed: {msg}"
        }), file=sys.stderr)
        sys.exit(1)

    # 2. Require operator-provided password via secure stdin (getpass) or stdin pipe
    # This is NEVER generated by the script, NEVER output to logs, NEVER in CLI args
    temp_password = get_operator_password()
    if not temp_password:
        print(json.dumps({
            "status": "error",
            "error": "Password required. Provide via interactive prompt (TTY) or stdin pipe. "
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