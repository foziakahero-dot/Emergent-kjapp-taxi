"""Release metadata used to prevent building against an older Render backend."""
import os
import sys
from pathlib import Path

os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'snar_release_test')
os.environ.setdefault('JWT_SECRET', 'unit-test-secret-that-is-long-enough-for-hs256')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


def test_exact_render_commit_is_public(monkeypatch):
    monkeypatch.setenv('RENDER_GIT_COMMIT', 'a' * 40)
    assert server.release_info() == {'commit': 'a' * 40, 'environment': server.APP_ENV}


def test_missing_or_malformed_commit_is_not_reflected(monkeypatch):
    for value in ('', 'short', 'invalid-runtime-configuration-value'):
        monkeypatch.setenv('RENDER_GIT_COMMIT', value)
        assert server.release_info()['commit'] == ''
