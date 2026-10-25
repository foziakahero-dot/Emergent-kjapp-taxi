import pytest

from qa_safety import (
    is_safe_qa_web_origin,
    reject_live_qa_stripe_event,
    validate_qa_configuration,
    validate_qa_stripe_configuration,
)


def qa_env(**overrides):
    return {
        "APP_ENV": "qa",
        "MONGO_URL": "mongodb+srv://qa-user:placeholder@qa-cluster.example.mongodb.net/",
        "DB_NAME": "snar_qa",
        "STRIPE_SECRET_KEY": "",
        "STRIPE_PUBLISHABLE_KEY": "",
        **overrides,
    }


def test_qa_configuration_accepts_separate_database_and_no_stripe():
    validate_qa_configuration(qa_env())


@pytest.mark.parametrize("database_name", ["kjapp", "kjapp_prod", "production", "snar"])
def test_qa_configuration_rejects_non_qa_database_names(database_name):
    with pytest.raises(RuntimeError, match="QA-named"):
        validate_qa_configuration(qa_env(DB_NAME=database_name))


def test_qa_configuration_rejects_production_database_host():
    env = qa_env(MONGO_URL="mongodb+srv://user:placeholder@cluster-prod.example.mongodb.net/")

    with pytest.raises(RuntimeError, match="identified as production"):
        validate_qa_configuration(env)


def test_qa_configuration_rejects_invalid_mongodb_uri():
    with pytest.raises(RuntimeError, match="valid MongoDB URI"):
        validate_qa_configuration(qa_env(MONGO_URL="not-a-mongodb-uri"))


@pytest.mark.parametrize("secret_key", ["sk_live_private", "rk_live_restricted", "unexpected"])
def test_qa_configuration_rejects_non_test_stripe_secret(secret_key):
    with pytest.raises(RuntimeError, match="test-mode secret"):
        validate_qa_configuration(qa_env(STRIPE_SECRET_KEY=secret_key))


def test_qa_configuration_rejects_live_stripe_publishable_key():
    with pytest.raises(RuntimeError, match="test-mode publishable"):
        validate_qa_configuration(qa_env(STRIPE_PUBLISHABLE_KEY="pk_live_public"))


def test_qa_configuration_accepts_test_mode_stripe_keys():
    validate_qa_configuration(
        qa_env(
            STRIPE_SECRET_KEY="sk_test_synthetic",
            STRIPE_PUBLISHABLE_KEY="pk_test_synthetic",
        )
    )


@pytest.mark.parametrize(
    "origin",
    [
        "https://snarapp.no",
        "https://admin.snarapp.no",
        "https://fleet.kjappapp.no",
        "http://qa.snarapp.no",
        "https://qa.snarapp.no/path",
        "https://qa.snarapp.no?next=/",
    ],
)
def test_qa_configuration_rejects_production_or_non_origin_web_urls(origin):
    with pytest.raises(RuntimeError, match="non-production HTTPS origin"):
        validate_qa_configuration(qa_env(KJAPP_PUBLIC_WEB_ORIGIN=origin))


def test_qa_configuration_accepts_an_isolated_https_web_origin():
    validate_qa_configuration(
        qa_env(
            KJAPP_PUBLIC_WEB_ORIGIN="https://qa.snarapp.no",
            KJAPP_CHECKOUT_ALLOWED_ORIGINS="https://qa.snarapp.no",
        )
    )


def test_qa_configuration_rejects_production_checkout_origin():
    with pytest.raises(RuntimeError, match="checkout origins"):
        validate_qa_configuration(
            qa_env(KJAPP_CHECKOUT_ALLOWED_ORIGINS="https://kjappapp.no")
        )


@pytest.mark.parametrize("origin", ["https://qa.snarapp.no", "https://api-qa.snarapp.no"])
def test_safe_qa_web_origin_accepts_qa_hosts(origin):
    assert is_safe_qa_web_origin(origin)


def test_safe_qa_web_origin_rejects_known_production_host():
    assert not is_safe_qa_web_origin("https://admin.kjappapp.no")


def test_non_qa_configuration_is_unchanged():
    validate_qa_configuration(
        {
            "APP_ENV": "production",
            "MONGO_URL": "not-validated-here",
            "DB_NAME": "kjapp",
            "STRIPE_SECRET_KEY": "sk_live_not-inspected",
        }
    )


def test_live_stripe_events_are_rejected_only_in_qa():
    event = {"livemode": True}

    assert reject_live_qa_stripe_event("qa", event)
    assert not reject_live_qa_stripe_event("production", event)
    assert not reject_live_qa_stripe_event("qa", {"livemode": False})
