"""Drivers cannot self-register: they join via a fleet invite and stay blocked until SNAR admin approves."""
from pathlib import Path
import re

SERVER = Path(__file__).resolve().parents[1] / "server.py"
SOURCE = SERVER.read_text(encoding="utf-8")


def _block(name: str) -> str:
    start = SOURCE.index(f"async def {name}")
    end = SOURCE.find("\nasync def ", start + 1)
    return SOURCE[start:] if end < 0 else SOURCE[start:end]


def test_public_register_never_creates_drivers():
    block = _block("register")
    assert '"role": "driver"' not in block


def test_invite_signup_creates_unapproved_driver():
    block = _block("accept_driver_invite")
    assert '"approved": False' in block
    assert '"approved": True' not in block
    assert '"pending_approval": True' in block


def test_require_driver_blocks_until_approved():
    block = _block("require_driver")
    assert 'current.get("approved") is not True' in block
    assert "SNAR admin" in block


def test_only_admin_endpoint_can_approve_drivers():
    writers = [m.start() for m in re.finditer(r'\{"\$set": \{"approved": body\.approved\}\}', SOURCE)]
    assert len(writers) == 1
    block = _block("admin_approve_driver")
    assert "Depends(require_admin)" in block
    assert '{"$set": {"approved": body.approved}}' in block


def test_fleet_endpoints_cannot_approve_drivers():
    for m in re.finditer(r'@api\.(post|patch|put)\("/fleet/[^"]*"\)\s*\nasync def (\w+)', SOURCE):
        block = _block(m.group(2))
        assert '"approved": True' not in block, m.group(2)
        assert '"approved": body' not in block, m.group(2)
