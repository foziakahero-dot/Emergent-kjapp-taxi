"""Runtime compatibility shim for Stripe Checkout setup sessions.

Stripe Checkout `mode=setup` already creates a SetupIntent intended for saving a
payment method. The currently deployed Stripe API rejects
`setup_intent_data[usage]`, so strip only that unsupported field while leaving
all other Checkout arguments untouched.

This module is loaded automatically by Python's site initialization when the
backend directory is on sys.path (Render starts uvicorn from backend/).
"""

try:
    import stripe

    _original_checkout_session_create = stripe.checkout.Session.create

    def _checkout_session_create_compat(*args, **kwargs):
        if kwargs.get("mode") == "setup":
            setup_data = kwargs.get("setup_intent_data")
            if isinstance(setup_data, dict) and "usage" in setup_data:
                sanitized = dict(setup_data)
                sanitized.pop("usage", None)
                if sanitized:
                    kwargs["setup_intent_data"] = sanitized
                else:
                    kwargs.pop("setup_intent_data", None)
        return _original_checkout_session_create(*args, **kwargs)

    stripe.checkout.Session.create = _checkout_session_create_compat
    print("[stripe-compat] Checkout setup-session compatibility enabled")
except Exception as exc:
    # Do not prevent backend startup if Stripe is unavailable during interpreter
    # initialization. The normal backend configuration checks remain authoritative.
    print(f"[stripe-compat] compatibility shim not installed: {type(exc).__name__}")
