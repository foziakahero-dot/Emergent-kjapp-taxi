#!/usr/bin/env python3
"""
Regression tests for QA superadmin bootstrap script fixes.

Covers three verified issues from independent review:
1. Duplicate "email" keys in MongoDB query - fixed with $and
2. platform_settings qa_mode/qa_database_isolated not persisted - removed incorrect check
3. stdin pipe password acceptance removed - only TTY getpass allowed
"""

import json
import os
import sys
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, Mock

import pytest

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.create_qa_superadmin import (
    validate_password_strength,
    get_operator_password,
    verify_qa_environment_config,
    verify_qa_database_identity,
)


class TestDuplicateEmailKeysFix:
    """Test that the MongoDB query correctly uses $and to combine regex and $ne."""

    def test_verify_qa_database_identity_excludes_qa_superadmin_from_production_check(self):
        """Verify the query correctly excludes qa-superadmin@snarapp.no from production domain check."""
        async def run_test():
            mock_db = AsyncMock()
            mock_db.name = "snar_qa"

            # platform_settings exists
            mock_db.platform_settings.find_one = AsyncMock(return_value={"_id": "singleton"})

            # No production domain users except qa-superadmin
            call_count = [0]
            async def count_documents_side_effect(query):
                # Verify the query uses $and with both conditions
                assert "$and" in query, "Query must use $and to combine conditions"
                and_conditions = query["$and"]
                assert len(and_conditions) == 2, "Must have two conditions in $and"

                # First condition: regex for domain (either snarapp.no or kjappapp.no)
                assert "email" in and_conditions[0]
                assert "$regex" in and_conditions[0]["email"]
                # re.escape() escapes dots, so pattern will be @snarapp\.no$ or @kjappapp\.no$
                regex_pattern = and_conditions[0]["email"]["$regex"]
                assert "@snarapp\\.no" in regex_pattern or "@kjappapp\\.no" in regex_pattern, f"Unexpected regex: {regex_pattern}"

                # Second condition: $ne for qa-superadmin
                assert "email" in and_conditions[1]
                assert "$ne" in and_conditions[1]["email"]
                assert and_conditions[1]["email"]["$ne"] == "qa-superadmin@snarapp.no"

                call_count[0] += 1
                return 0  # No other production users

            mock_db.users.count_documents = AsyncMock(side_effect=count_documents_side_effect)

            # Should pass verification
            result, msg = await verify_qa_database_identity(mock_db, "snar_qa")
            assert result is True, f"Expected True, got False: {msg}"
            assert msg == "OK"

        asyncio.run(run_test())

    def test_verify_qa_database_identity_fails_on_non_qa_production_users(self):
        """Verify verification fails when non-QA production domain users exist."""
        async def run_test():
            mock_db = AsyncMock()
            mock_db.name = "snar_qa"
            mock_db.platform_settings.find_one = AsyncMock(return_value={"_id": "singleton"})

            # Simulate finding a non-QA production user
            mock_db.users.count_documents = AsyncMock(return_value=1)

            result, msg = await verify_qa_database_identity(mock_db, "snar_qa")
            assert result is False
            assert "not isolated QA" in msg
            assert "1" in msg

        asyncio.run(run_test())


class TestPlatformSettingsVerificationFix:
    """Test that platform_settings verification doesn't check for non-existent qa_mode/qa_database_isolated."""

    def test_verify_qa_database_identity_does_not_require_qa_mode_in_settings(self):
        """Verify that qa_mode and qa_database_isolated are NOT required in platform_settings."""
        async def run_test():
            mock_db = AsyncMock()
            mock_db.name = "snar_qa"

            # platform_settings exists but WITHOUT qa_mode or qa_database_isolated
            # (these are computed dynamically by /ready, not stored)
            mock_db.platform_settings.find_one = AsyncMock(return_value={
                "_id": "singleton",
                "pricing": {},
                "features": {"surge": True, "booking_enabled": True},
                "compliance": {}
            })

            mock_db.users.count_documents = AsyncMock(return_value=0)

            # Should pass verification even without qa_mode/qa_database_isolated in stored doc
            result, msg = await verify_qa_database_identity(mock_db, "snar_qa")
            assert result is True, f"Expected True, got False: {msg}"

        asyncio.run(run_test())

    def test_verify_qa_database_identity_fails_when_platform_settings_missing(self):
        """Verify verification fails when platform_settings singleton doesn't exist."""
        async def run_test():
            mock_db = AsyncMock()
            mock_db.name = "snar_qa"
            mock_db.platform_settings.find_one = AsyncMock(return_value=None)

            result, msg = await verify_qa_database_identity(mock_db, "snar_qa")
            assert result is False
            assert "platform_settings singleton not found" in msg

        asyncio.run(run_test())


class TestStdinPipeRemovalFix:
    """Test that stdin pipe password acceptance is removed - only TTY getpass allowed."""

    def test_get_operator_password_returns_empty_without_tty(self):
        """Verify get_operator_password returns empty string when not on TTY (no pipe fallback)."""
        # Simulate non-TTY stdin (e.g., piped input or CI)
        mock_stdin = Mock()
        mock_stdin.isatty.return_value = False
        mock_stdin.read.return_value = "piped_password"
        with patch.object(sys, 'stdin', mock_stdin):
            result = get_operator_password()
            assert result == "", "Should return empty string without TTY (no pipe fallback)"

    def test_get_operator_password_returns_empty_with_empty_stdin(self):
        """Verify get_operator_password returns empty string when stdin is empty."""
        mock_stdin = Mock()
        mock_stdin.isatty.return_value = False
        mock_stdin.read.return_value = ""
        with patch.object(sys, 'stdin', mock_stdin):
            result = get_operator_password()
            assert result == ""

    def test_get_operator_password_uses_getpass_on_tty(self):
        """Verify get_operator_password uses getpass on TTY."""
        mock_stdin = Mock()
        mock_stdin.isatty.return_value = True
        with patch.object(sys, 'stdin', mock_stdin):
            with patch('getpass.getpass', return_value="SecurePass123!@#"):
                result = get_operator_password()
                assert result == "SecurePass123!@#"

    def test_no_environment_variable_fallback(self):
        """Verify QA_SUPERADMIN_PASSWORD environment variable is NOT used."""
        mock_stdin = Mock()
        mock_stdin.isatty.return_value = False
        mock_stdin.read.return_value = ""
        with patch.object(sys, 'stdin', mock_stdin):
            with patch.dict(os.environ, {"QA_SUPERADMIN_PASSWORD": "env_password"}):
                result = get_operator_password()
                assert result == "", "Should NOT fall back to environment variable"


class TestPasswordStrengthValidation:
    """Test password strength validation still works correctly."""

    def test_valid_password(self):
        valid, msg = validate_password_strength("SecurePass123!@#LongEnough")
        assert valid is True
        assert msg == "OK"

    def test_too_short(self):
        valid, msg = validate_password_strength("Short1!")
        assert valid is False
        assert "16 characters" in msg

    def test_no_uppercase(self):
        valid, msg = validate_password_strength("lowercase123!@#longenough")
        assert valid is False
        assert "uppercase" in msg

    def test_no_lowercase(self):
        valid, msg = validate_password_strength("UPPERCASE123!@#LONGENOUGH")
        assert valid is False
        assert "lowercase" in msg

    def test_no_digit(self):
        valid, msg = validate_password_strength("NoDigitsHere!@#LongEnough")
        assert valid is False
        assert "digit" in msg

    def test_no_special_char(self):
        valid, msg = validate_password_strength("NoSpecialChars123LongEnough")
        assert valid is False
        assert "special character" in msg


class TestQAEnvironmentConfig:
    """Test QA environment configuration verification."""

    def test_valid_qa_config(self):
        with patch.dict(os.environ, {
            "APP_ENV": "qa",
            "DB_NAME": "snar_qa",
            "MONGO_URL": "mongodb://localhost:27017"
        }):
            valid, msg = verify_qa_environment_config()
            assert valid is True
            assert msg == "OK"

    def test_invalid_app_env(self):
        with patch.dict(os.environ, {
            "APP_ENV": "production",
            "DB_NAME": "snar_qa",
            "MONGO_URL": "mongodb://localhost:27017"
        }):
            valid, msg = verify_qa_environment_config()
            assert valid is False
            assert "APP_ENV must be exactly 'qa'" in msg

    def test_invalid_db_name_pattern(self):
        with patch.dict(os.environ, {
            "APP_ENV": "qa",
            "DB_NAME": "snar_prod",
            "MONGO_URL": "mongodb://localhost:27017"
        }):
            valid, msg = verify_qa_environment_config()
            assert valid is False
            assert "does not match QA database pattern" in msg

    def test_production_mongo_url_rejected(self):
        with patch.dict(os.environ, {
            "APP_ENV": "qa",
            "DB_NAME": "snar_qa",
            "MONGO_URL": "mongodb://prod-cluster:27017"
        }):
            valid, msg = verify_qa_environment_config()
            assert valid is False
            assert "production environment" in msg


if __name__ == "__main__":
    pytest.main([__file__, "-v"])