"""Safety regressions for live-target rejection and stale/corrupt artifacts."""
import copy
import hashlib
from pathlib import Path
import tempfile
import unittest
import zipfile

from run_beta_suite import validate_manifest


class RunnerGuards(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.apk = Path(self.directory.name) / "fixture.apk"
        with zipfile.ZipFile(self.apk, "w") as archive:
            archive.writestr("AndroidManifest.xml", "synthetic manifest")
            archive.writestr("classes.dex", b"dex\n035\0" + bytes(1024))
        self.manifest = {
            "api": "https://api-qa.snarapp.no", "profile": "qa", "appId": "no.kjapp.app",
            "projectId": "3631002e-5b25-4847-b5d8-05ec2ef304b5",
            "sourceSha": "a" * 40, "backendSha": "b" * 40,
            "buildId": "283d843c-f11a-45ff-a69e-e800b5d0526f",
            "apkSha256": hashlib.sha256(self.apk.read_bytes()).hexdigest(),
        }

    def test_independently_pinned_mobile_and_backend_are_allowed(self):
        validate_manifest(self.manifest, self.apk)

    def test_production_and_other_hosts_are_rejected(self):
        for host in ("https://api.snarapp.no", "https://api.kjappapp.no", "https://api-qa.snarapp.no.evil.invalid"):
            with self.subTest(host=host), self.assertRaises(ValueError):
                validate_manifest({**self.manifest, "api": host}, self.apk)

    def test_production_profile_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_manifest({**self.manifest, "profile": "production"}, self.apk)

    def test_other_app_and_project_are_rejected(self):
        for key, value in (("appId", "no.kjapp.driver"), ("projectId", "another-project")):
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_manifest({**self.manifest, key: value}, self.apk)

    def test_short_or_missing_release_identity_is_rejected(self):
        for key in ("sourceSha", "backendSha", "buildId", "apkSha256"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_manifest({**self.manifest, key: "abc"}, self.apk)

    def test_changed_apk_does_not_match_a_previous_manifest(self):
        self.apk.write_bytes(self.apk.read_bytes() + b"changed")
        with self.assertRaisesRegex(ValueError, "checksum"):
            validate_manifest(self.manifest, self.apk)

    def test_error_page_cannot_be_used_as_an_apk_even_with_its_checksum(self):
        self.apk.write_text("<html>provider error</html>")
        changed = {**self.manifest, "apkSha256": hashlib.sha256(self.apk.read_bytes()).hexdigest()}
        with self.assertRaisesRegex(ValueError, "Android APK"):
            validate_manifest(changed, self.apk)


if __name__ == "__main__":
    unittest.main()
