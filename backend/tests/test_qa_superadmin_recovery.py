"""Negative recovery gates and atomic credential rotation; no live database."""
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import bcrypt
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import recover_qa_superadmin as recovery


def database():
    db = MagicMock()
    db.name = 'snar_qa'
    db.users.count_documents = AsyncMock(return_value=1)
    db.users.find_one = AsyncMock(return_value={
        '_id': 'fixture', 'role': 'superadmin', 'approved': True, 'disabled': False,
        'must_reset_password': True, 'totp_enabled': False,
    })
    db.users.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    return db


def run(db, **kwargs):
    with patch.dict(recovery.os.environ, {'DB_NAME': 'snar_qa'}), \
         patch.object(recovery, 'verify_qa_environment_config', return_value=(True, 'OK')), \
         patch.object(recovery, 'verify_qa_database_identity', new=AsyncMock(return_value=(True, 'OK'))):
        return asyncio.run(recovery.recover(db, **kwargs))


def test_default_is_read_only_and_never_requests_password():
    db = database()
    reader = MagicMock(side_effect=AssertionError('Password prompt during read-only check'))
    assert run(db, password_provider=reader)['status'] == 'eligible'
    db.users.update_one.assert_not_called()
    reader.assert_not_called()
    projection = db.users.find_one.call_args.args[1]
    assert 'password_hash' not in projection and 'totp_secret' not in projection


@pytest.mark.parametrize('field,value', [('totp_enabled', True), ('disabled', True),
    ('approved', False), ('must_reset_password', False), ('role', 'admin')])
def test_rejects_accounts_outside_unfinished_bootstrap_state(field, value):
    db = database()
    db.users.find_one.return_value[field] = value
    with pytest.raises(RuntimeError):
        run(db, apply=True, password_provider=MagicMock(side_effect=AssertionError()))
    db.users.update_one.assert_not_called()


def test_duplicate_superadmins_refused():
    db = database()
    db.users.count_documents.return_value = 2
    with pytest.raises(RuntimeError):
        run(db, apply=True)
    db.users.update_one.assert_not_called()


def test_wrong_database_refused():
    db = database()
    db.name = 'snar_prod'
    with pytest.raises(RuntimeError):
        run(db, apply=True)
    db.users.update_one.assert_not_called()


def test_live_identity_mismatch_refused_before_any_account_access():
    db = database()
    with patch.dict(recovery.os.environ, {'DB_NAME': 'snar_qa'}), \
         patch.object(recovery, 'verify_qa_environment_config', return_value=(True, 'OK')), \
         patch.object(recovery, 'verify_qa_database_identity', new=AsyncMock(return_value=(False, 'mismatch'))):
        with pytest.raises(RuntimeError):
            asyncio.run(recovery.recover(db, apply=True))
    db.users.find_one.assert_not_called()
    db.users.update_one.assert_not_called()


def test_non_tty_refused_without_getpass():
    with patch.object(recovery.sys.stdin, 'isatty', return_value=False), \
         patch.object(recovery.getpass, 'getpass') as reader:
        with pytest.raises(RuntimeError):
            recovery.read_new_password()
        reader.assert_not_called()


def test_confirmation_mismatch_refused():
    with patch.object(recovery.sys.stdin, 'isatty', return_value=True), \
         patch.object(recovery.getpass, 'getpass', side_effect=['fixture-only', 'different-fixture']):
        with pytest.raises(RuntimeError):
            recovery.read_new_password()


def test_getpass_echo_fallback_is_refused():
    def echo_fallback(*args):
        recovery.warnings.warn('No echo control', recovery.getpass.GetPassWarning)
        raise AssertionError('Echo fallback must never continue')
    with patch.object(recovery.sys.stdin, 'isatty', return_value=True), \
         patch.object(recovery.getpass, 'getpass', side_effect=echo_fallback):
        with pytest.raises(recovery.getpass.GetPassWarning):
            recovery.read_new_password()


def test_rejected_arguments_are_never_echoed(capsys):
    parser = recovery.PrivateArgumentParser()
    with pytest.raises(SystemExit):
        parser.parse_args(['--password', 'synthetic-sensitive-argument'])
    captured = capsys.readouterr()
    assert 'synthetic-sensitive-argument' not in captured.err + captured.out


def test_rotation_invalidates_sessions_preserves_permissions_and_never_returns_password():
    db = database()
    # Synthetic test-only value; no real credential is stored by this test.
    password = 'Synthetic-fixture-42!'
    result = run(db, apply=True, password_provider=lambda: password)
    query, mutation = db.users.update_one.call_args.args
    changed = mutation['$set']
    assert bcrypt.checkpw(password.encode(), changed['password_hash'].encode())
    assert changed['must_reset_password'] is False and changed['tokens_valid_after'] > 0
    assert query['tokens_valid_after'] == {'$exists': False}
    assert not {'role', 'permissions', 'approved', 'disabled', 'totp_enabled', 'totp_secret'} & changed.keys()
    assert password not in str(result) and 'password_hash' not in result


def test_concurrent_change_fails_closed():
    db = database()
    db.users.update_one.return_value.modified_count = 0
    with pytest.raises(RuntimeError):
        run(db, apply=True, password_provider=lambda: 'Synthetic-fixture-42!')
