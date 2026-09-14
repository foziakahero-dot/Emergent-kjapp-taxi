# Backend release hardening composition

`server_core.py` is the preserved pre-hardening KJAPP FastAPI implementation. `server.py` is the runtime composition root and imports `hardening.py`, which removes only an explicit allow-list of legacy routes and installs hardened replacements for trip state, payment ownership/idempotency, Stripe refund linkage, and message read-state authorization.

This split exists so the large legacy backend can remain byte-for-byte stable while security-critical route changes stay small and reviewable. New backend work should move hardened logic into normal domain/router modules over time rather than adding more overrides.
