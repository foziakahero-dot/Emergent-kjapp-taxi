import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai_configuration import configured_ai_key, provider_chat_session


def test_qa_never_inherits_or_enables_shared_ai_keys():
    env={'APP_ENV':'qa','SNAR_AI_KEY':'shared','EMERGENT_LLM_KEY':'shared-storage'}
    assert configured_ai_key(env)==''
    env['QA_SNAR_AI_KEY']='dedicated-qa'
    assert configured_ai_key(env)==''
    env['QA_AI_ENABLED']='true'
    assert configured_ai_key(env)=='dedicated-qa'
    env['SNAR_AI_KEY']='another-admin-key'
    assert configured_ai_key(env)=='dedicated-qa'
    env['QA_AI_ENABLED']='false'
    assert configured_ai_key(env)==''


def test_existing_provider_configuration_is_preserved_outside_qa():
    assert configured_ai_key({'SNAR_AI_KEY':'existing'})=='existing'
    assert configured_ai_key({'EMERGENT_LLM_KEY':'existing'})=='existing'


def test_provider_chat_history_is_scoped_to_user_and_environment():
    session=provider_chat_session('qa','customer-a','same-session')
    assert session==provider_chat_session('qa','customer-a','same-session')
    assert session!=provider_chat_session('qa','customer-b','same-session')
    assert session!=provider_chat_session('production','customer-a','same-session')
    assert 'customer-a' not in session and 'same-session' not in session
