#!/usr/bin/env python3
"""Operator-only password recovery for the isolated, unfinished QA bootstrap account.

Default mode only checks eligibility. --apply requires an interactive TTY;
the operator enters and confirms the new password privately. Never pass a
password through argv, environment variables, a pipe, a file or browser tools.
No production account, role, approval or existing 2FA enrollment is changed.
"""

import argparse
import asyncio
import getpass
import json
import os
import sys
import warnings
from datetime import datetime, timezone

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

try:
    from .create_qa_superadmin import (
        validate_password_strength, verify_qa_database_identity,
        verify_qa_environment_config,
    )
except ImportError:
    from create_qa_superadmin import (
        validate_password_strength, verify_qa_database_identity,
        verify_qa_environment_config,
    )

ACCOUNT = "qa-superadmin@snarapp.no"
DATABASE = "snar_qa"


class PrivateArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        # argparse normally echoes rejected argv, which could contain a secret.
        self.exit(2, "Unsupported arguments. Enter passwords only at the private TTY prompt.\n")


def read_new_password():
    if not sys.stdin.isatty():
        raise RuntimeError("Private TTY required; pipes and files are refused.")
    # getpass must never silently fall back to echoed input.
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        first = getpass.getpass("New QA password (16+, uppercase/lowercase/digit/symbol): ")
        second = getpass.getpass("Confirm new QA password: ")
    if first != second:
        raise RuntimeError("The two password entries differ; nothing changed.")
    valid, message = validate_password_strength(first)
    if not valid:
        raise RuntimeError(message)
    if len(first.encode("utf-8")) > 72:
        raise RuntimeError("Password exceeds bcrypt's 72-byte limit.")
    return first


async def recover(db, *, apply=False, password_provider=read_new_password):
    valid, _ = verify_qa_environment_config()
    if not valid or os.environ.get("DB_NAME") != DATABASE or db.name != DATABASE:
        raise RuntimeError("Canonical QA environment verification failed.")
    valid, _ = await verify_qa_database_identity(db, DATABASE)
    if not valid:
        raise RuntimeError("Live QA database/Atlas identity verification failed.")
    if await db.users.count_documents({"role": "superadmin"}) != 1:
        raise RuntimeError("Expected exactly one existing QA Superadmin.")
    account = await db.users.find_one(
        {"email": ACCOUNT, "role": "superadmin"},
        {"_id": 1, "role": 1, "approved": 1, "disabled": 1,
         "must_reset_password": 1, "totp_enabled": 1, "tokens_valid_after": 1},
    )
    required = {"role": "superadmin", "approved": True, "disabled": False,
                "must_reset_password": True, "totp_enabled": False}
    if not account or any(account.get(key) != value for key, value in required.items()):
        raise RuntimeError("Account is not an unfinished QA bootstrap account.")
    if not apply:
        return {"status": "eligible", "account": ACCOUNT, "changed": False}

    password = password_provider()
    valid, _ = validate_password_strength(password)
    if not valid or len(password.encode("utf-8")) > 72:
        raise RuntimeError("New password does not satisfy the QA password policy.")
    new_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    del password
    cutoff = datetime.now(timezone.utc).timestamp()
    predicate = {"_id": account["_id"], "email": ACCOUNT, **required,
                 "tokens_valid_after": account.get("tokens_valid_after", {"$exists": False})}
    result = await db.users.update_one(predicate, {"$set": {
        "password_hash": new_hash, "tokens_valid_after": cutoff,
        # The operator just chose and confirmed their own permanent password.
        "must_reset_password": False, "qa_password_recovered_at": cutoff,
    }})
    if result.modified_count != 1:
        raise RuntimeError("Account changed concurrently; recovery was not applied.")
    return {"status": "updated", "account": ACCOUNT, "sessions_invalidated": True,
            "twofa_enabled": False, "next": "Enable 2FA privately before Admin access."}


async def main(apply):
    valid, _ = verify_qa_environment_config()
    if not valid or os.environ.get("DB_NAME") != DATABASE:
        raise RuntimeError("Canonical QA configuration required.")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=10000)
    try:
        return await recover(client[DATABASE], apply=apply)
    finally:
        client.close()


if __name__ == "__main__":
    parser = PrivateArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Operator-only private password entry")
    args = parser.parse_args()
    try:
        print(json.dumps(asyncio.run(main(args.apply))))
    except (Exception, KeyboardInterrupt):
        # Connection errors can contain a URI; never print exception details.
        print(json.dumps({"status": "stopped", "error": "Recovery did not complete. No credentials were disclosed."}), file=sys.stderr)
        sys.exit(1)
