# Backend release hardening composition

`server_core.py` is the byte-for-byte preserved backend implementation that previously lived at `server.py`. Its Git blob SHA matches `main/backend/server.py` (`d74d057191a5aa9bb57130abea3784929a34df98`).

`server.py` is now the runtime composition root. It keeps the established `uvicorn server:app` contract, supports both repository-root and `backend/` working directories, imports the preserved core, and activates `hardening.py`.

`hardening.py` removes only an explicit allow-list of security/state-sensitive FastAPI routes from the constructed app and registers one hardened replacement for each removed route. Import fails fast if an expected legacy route is missing or duplicated, preventing silent partial hardening.

Current hardened domains:
- passenger cancellation/completion/rating state transitions;
- driver passenger-rating state transition;
- Stripe card-setup ownership;
- Checkout ownership, open-session reuse and concurrent-creation lock;
- payment-status ownership and reconciliation;
- Stripe webhook paid-state/refund linkage;
- message read-state ownership.

Regression coverage is in `backend/tests/test_release_state_guards.py`.

This split is deliberately narrow for the release branch: the large existing backend remains unchanged while the release-critical rules are reviewable in a small module. Future backend work should move these rules into normal domain/router modules rather than accumulating additional overrides here.
