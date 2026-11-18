import importlib.util
import os
from pathlib import Path
import stat
import subprocess
import sys

MODULE_PATH = Path(__file__).resolve().parents[1] / "selfhost" / "manage.py"
spec = importlib.util.spec_from_file_location("snar_selfhost", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_internal_credentials_are_distinct_and_never_rotated(tmp_path):
    assert module.prepare(tmp_path) is True
    path = tmp_path / ".env"
    first = path.read_bytes()
    values = dict(line.split("=", 1) for line in first.decode().splitlines() if line and not line.startswith("#"))
    assert set(values) == set(module.SECRET_KEYS)
    assert len(set(values.values())) == len(values)
    assert all(len(value) == 64 for value in values.values())
    assert module.prepare(tmp_path) is False
    assert path.read_bytes() == first
    if os.name == "posix":
        assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_broken_existing_credentials_are_never_overwritten(tmp_path):
    path = tmp_path / ".env"
    path.write_text("JWT_SECRET=existing\n")
    import pytest
    with pytest.raises(ValueError):
        module.prepare(tmp_path)
    assert path.read_text() == "JWT_SECRET=existing\n"


def test_missing_docker_fails_closed_before_creating_files(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(module, "ROOT", tmp_path)
    monkeypatch.setattr(module.shutil, "which", lambda _: None)
    assert module.run("start") == 2
    assert not (tmp_path / ".env").exists()
    assert "BLOCKED" in capsys.readouterr().err


def test_compose_binds_only_loopback_persists_data_and_pins_image():
    import yaml
    document = yaml.safe_load(MODULE_PATH.with_name("compose.yaml").read_text())
    service = document["services"]["budibase"]
    assert service["ports"] == ["127.0.0.1:10000:80"]
    assert service["volumes"] == ["budibase_data:/data"]
    assert "@sha256:" in service["image"]
    assert "privileged" not in service
