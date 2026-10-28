from test_phase2c_dispatch_identity_projection import server


def test_first_selfie_is_optional_only_when_server_policy_is_optional(monkeypatch):
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', False)
    driver = {'role': 'driver', 'approved': True, 'identity_verification_status': 'not_submitted'}
    assert server.user_public(driver)['identity_verification_required'] is False
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', True)
    assert server.user_public(driver)['identity_verification_required'] is True


def test_recheck_cannot_be_bypassed_by_optional_first_selfie_policy(monkeypatch):
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', False)
    for status in ['recheck_required', 'retry_required']:
        assert server.user_public({'role': 'driver', 'identity_verification_status': status})['identity_verification_required'] is True
    assert server.user_public({'role': 'driver', 'identity_verification_status': 'pending_review',
        'identity_verified_at': '2026-10-01T12:00:00Z'})['identity_verification_required'] is True


def test_customer_never_inherits_driver_selfie_gate(monkeypatch):
    monkeypatch.setattr(server, 'KJAPP_DRIVER_IDENTITY_REQUIRED', True)
    assert server.user_public({'role': 'user'})['identity_verification_required'] is False
