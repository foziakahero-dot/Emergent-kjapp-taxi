import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
import pytest
from driver_profile_match import compare_driver_files, compare_report, match_photos


@pytest.mark.parametrize("faces,matches,passed", [(1,1,True),(2,1,False),(0,0,False),(1,0,False)])
def test_both_target_images_must_contain_one_matching_face(faces, matches, passed):
    client = Mock()
    client.detect_faces.return_value = {"FaceDetails": [{}] * faces}
    client.compare_faces.return_value = {"FaceMatches": [{}] * matches}
    assert match_photos(client, b"synthetic selfie", [b"profile", b"licence"]) is passed
    if passed:
        assert [c.kwargs["TargetImage"]["Bytes"] for c in client.compare_faces.call_args_list] == [b"profile", b"licence"]


def test_report_from_other_session_cannot_supply_a_selfie():
    client = Mock()
    client.v1.identity.verification_reports.retrieve.return_value = {
        "verification_session":"vs_other", "livemode":False, "document":{"type":"driving_license","status":"verified"},
        "selfie":{"status":"verified","selfie":"file_fixture"}}
    assert not compare_report(client, {"id":"vs_expected","livemode":False,"last_verification_report":"vr_fixture"}, [])
    client.v1.file_links.create.assert_not_called()


def test_missing_owned_profile_skips_external_processing():
    files = SimpleNamespace(find_one=AsyncMock(return_value=None))
    read = AsyncMock()
    driver = {"_id":"fixture", "profile_photo_path":"profile", "drivers_license_path":"licence"}
    assert not asyncio.run(compare_driver_files(SimpleNamespace(uploaded_files=files), driver, read, None, {}))
    assert files.find_one.await_args.args[0]["owner_user_id"] == "fixture"
    read.assert_not_awaited()


def test_verified_report_selfie_is_compared_against_both_owned_photos(monkeypatch):
    client = Mock()
    client.v1.identity.verification_reports.retrieve.return_value = {
        "verification_session":"vs_x","livemode":False,"document":{"type":"driving_license","status":"verified"},
        "selfie":{"status":"verified","selfie":"file_fixture"}}
    client.v1.file_links.create.return_value = {"url":"https://files.stripe.com/links/fixture"}
    from unittest.mock import MagicMock
    response = MagicMock()
    response.__enter__.return_value = response
    response.status_code = 200
    response.iter_content.return_value = [b"verified selfie"]
    get = Mock(return_value=response)
    monkeypatch.setattr("driver_profile_match.requests.get", get)
    recognition = Mock()
    recognition.detect_faces.return_value = {"FaceDetails":[{}]}
    recognition.compare_faces.side_effect = [{"FaceMatches":[{}]}, {"FaceMatches":[]}]
    monkeypatch.setattr("driver_profile_match.boto3.client", Mock(return_value=recognition))
    db = SimpleNamespace(uploaded_files=SimpleNamespace(find_one=AsyncMock(return_value={"_id":"fixture"})))
    read = AsyncMock(side_effect=[(b"portrait","image/jpeg"),(b"licence","image/png")])
    driver = {"_id":"owner","profile_photo_path":"portrait-file","drivers_license_path":"licence-file"}
    session = {"id":"vs_x","livemode":False,"last_verification_report":"vr_x"}
    assert not asyncio.run(compare_driver_files(db, driver, read, client, session))
    assert recognition.compare_faces.call_count == 2
    assert all(call.kwargs["SourceImage"] == {"Bytes":b"verified selfie"} for call in recognition.compare_faces.call_args_list)
    assert get.call_args.kwargs["allow_redirects"] is False
