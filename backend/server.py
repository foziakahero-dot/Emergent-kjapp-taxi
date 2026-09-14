"""KJAPP backend runtime composition root.

The established backend implementation is preserved byte-for-byte in ``server_core.py``.
``hardening.py`` then replaces only an explicit allow-list of security/state-sensitive routes.
Keeping this file tiny makes the release hardening reviewable and avoids risky edits to the large
legacy monolith while preserving the existing runtime contract: ``uvicorn server:app``.
"""

# Re-export the existing module surface for backwards compatibility with scripts/tests that import
# symbols from ``server`` directly.
from server_core import *  # noqa: F401,F403
from hardening import app  # noqa: E402,F401


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
