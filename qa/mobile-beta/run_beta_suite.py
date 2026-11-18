"""Run real Android Maestro flows against a pinned QA APK on an emulator.

No account is created. Use a dedicated qa-*@example.invalid customer with no
active trip. Raw Maestro output is private; the report contains safe results.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import zipfile
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://api-qa.snarapp.no"
ROOT = Path(__file__).resolve().parents[2]
FLOWS = ROOT / "frontend/.maestro/beta"
CASES = {"booking": "01-booking.yml", "theme": "02-dark-mode.yml",
         "privacy_language": "03-privacy-language.yml", "empty_search": "04-search-empty.yml",
         "offline": "05-offline.yml"}


def api(path, method="GET", body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request(BASE + "/api" + path, method=method, headers=headers,
                      data=None if body is None else json.dumps(body).encode())
    try:
        with urlopen(request, timeout=20) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, {}  # Never expose remote account/provider bodies.


def validate_manifest(manifest, apk):
    if manifest.get("api") != BASE or manifest.get("profile") != "qa":
        raise ValueError("Only the isolated QA API and qa profile are allowed")
    if manifest.get("appId") != "no.kjapp.app" or manifest.get("projectId") != "3631002e-5b25-4847-b5d8-05ec2ef304b5":
        raise ValueError("Customer QA app/project identity mismatch")
    for key in ("backendSha", "sourceSha"):
        if not re.fullmatch(r"[0-9a-f]{40}", manifest.get(key, "")):
            raise ValueError("A full reviewed source/backend SHA is required")
    if not re.fullmatch(r"[0-9a-f-]{36}", manifest.get("buildId", "")):
        raise ValueError("Supply the actual completed EAS build ID")
    if not re.fullmatch(r"[0-9a-f]{64}", manifest.get("apkSha256", "")):
        raise ValueError("Supply the downloaded QA APK SHA-256")
    if hashlib.sha256(apk.read_bytes()).hexdigest() != manifest["apkSha256"]:
        raise ValueError("QA APK checksum mismatch")
    try:
        with zipfile.ZipFile(apk) as archive:
            names = set(archive.namelist())
            if "AndroidManifest.xml" not in names or "classes.dex" not in names:
                raise ValueError("Artifact is not an Android APK")
    except zipfile.BadZipFile:
        raise ValueError("Artifact is not an Android APK") from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--cases", nargs="+", choices=CASES, default=["theme", "privacy_language"])
    parser.add_argument("--output", type=Path, default=ROOT / ".qa-results/mobile-beta")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    os.chmod(args.output, 0o700)
    report = {"time": datetime.now(timezone.utc).isoformat(), "api": BASE,
              "cases": [{"case": name, "status": "NOT RUN"} for name in args.cases]}
    token = None
    baseline_trip = None
    fixture_ready = False
    network_changed = False
    wifi_before, data_before = "1", "1"

    def adb(*command):
        return subprocess.check_output(["adb", "-s", args.serial, *command], text=True, timeout=30).strip()

    def restore_network():
        adb("shell", "svc", "wifi", "enable" if wifi_before == "1" else "disable")
        adb("shell", "svc", "data", "enable" if data_before == "1" else "disable")

    def maestro(flow, name):
        # Environment variables keep passwords out of command arguments.
        env = {**os.environ, "MAESTRO_APP_ID": "no.kjapp.app"}
        log = args.output / (name + ".private.log")
        with log.open("w") as stream:
            os.chmod(log, 0o600)
            return subprocess.run(["maestro", "test", "--format", "junit", "--output",
                                   str(args.output / (name + ".xml")), str(flow)],
                                  env=env, stdout=stream, stderr=subprocess.STDOUT, timeout=240).returncode

    try:
        manifest = json.loads(args.manifest.read_text())
        validate_manifest(manifest, args.apk)
        report["release"] = {k: manifest[k] for k in ("sourceSha", "backendSha", "buildId", "apkSha256")}
        if not shutil.which("adb") or not shutil.which("maestro"):
            raise ValueError("Android SDK/adb and Maestro are required")
        if adb("shell", "getprop", "ro.kernel.qemu") != "1":
            raise ValueError("This runner only changes a disposable Android emulator")
        email = os.environ.get("MAESTRO_QA_CUSTOMER_EMAIL", "")
        password = os.environ.get("MAESTRO_QA_CUSTOMER_PASSWORD", "")
        if not re.fullmatch(r"qa-[a-zA-Z0-9_.+-]+@example\.invalid", email) or not password:
            raise ValueError("Dedicated synthetic QA customer credentials are required")
        status, ready = api("/ready")
        checks = ready.get("checks", {})
        if status != 200 or ready.get("ready") is not True or ready.get("blockers") != [] or ready.get("release") != {"environment": "qa", "commit": manifest["backendSha"]}:
            raise ValueError("Reviewed QA runtime is not ready")
        if checks.get("production_mode") is not False or checks.get("auto_charge_enabled") is not False or any(checks.get(k) is not True for k in ("qa_mode", "qa_database_isolated", "stripe_test_mode_configured")):
            raise ValueError("QA isolation and disabled automatic live charging are required")
        status, payment = api("/payments/native/config")
        if status != 200 or payment.get("test_mode") is not True:
            raise ValueError("Stripe TEST mode is not confirmed")
        if "booking" in args.cases and payment.get("cash_enabled") is not True:
            raise ValueError("Synthetic booking test requires QA cash enabled")
        status, auth = api("/auth/login", "POST", {"email": email, "password": password, "client": "customer"})
        if status != 200 or auth.get("user", {}).get("role") not in ("user", "customer") or not auth.get("token"):
            raise ValueError("Synthetic customer login failed")
        token = auth["token"]
        status, baseline_trip = api("/trips/active", token=token)
        if status != 200 or baseline_trip:
            raise ValueError("Use a dedicated fixture with no active trip")
        fixture_ready = True
        adb("install", "-r", str(args.apk.resolve()))
        for row in report["cases"]:
            started = time.monotonic()
            try:
                if row["case"] == "offline":
                    if maestro(FLOWS / "common/login.yml", "offline-login"):
                        raise ValueError("Offline test login prerequisite failed")
                    wifi_before = adb("shell", "settings", "get", "global", "wifi_on")
                    data_before = adb("shell", "settings", "get", "global", "mobile_data")
                    network_changed = True
                    adb("shell", "svc", "wifi", "disable")
                    adb("shell", "svc", "data", "disable")
                row["status"] = "PASS" if maestro(FLOWS / CASES[row["case"]], row["case"]) == 0 else "FAIL"
            except subprocess.TimeoutExpired:
                row.update(status="FAIL", reason="Maestro timeout")
            finally:
                if network_changed:
                    restore_network()
                    network_changed = False
                row["seconds"] = round(time.monotonic() - started, 2)
            if row["status"] != "PASS":
                break  # No retries that turn a flaky release gate green.
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        report["blocker"] = str(error) if isinstance(error, ValueError) else type(error).__name__
        for row in report["cases"]:
            if row["status"] == "NOT RUN":
                row.update(status="BLOCKED", reason=report["blocker"])
    finally:
        if network_changed:
            try:
                restore_network()
            except Exception:
                report["network_cleanup"] = "FAIL"
        if token and fixture_ready:
            try:
                status, active = api("/trips/active", token=token)
                if status == 200 and active:
                    if "booking" not in args.cases or active.get("payment_provider") != "cash" or active.get("status") not in ("searching", "booking", "driver_on_way", "at_pickup"):
                        report["trip_cleanup"] = "BLOCKED: inspect synthetic trip state"
                    else:
                        code, _ = api("/trips/" + active["trip_id"] + "/cancel", "POST", {}, token)
                        report["trip_cleanup"] = "PASS" if code == 200 else "FAIL"
                api("/auth/logout", "POST", {}, token)
            except Exception:
                report["trip_cleanup"] = "BLOCKED: QA unavailable"
        (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(report, ensure_ascii=False, indent=2))
    clean = report.get("trip_cleanup", "PASS") == "PASS" and report.get("network_cleanup", "PASS") == "PASS"
    return 0 if clean and all(row["status"] == "PASS" for row in report["cases"]) else 2


if __name__ == "__main__":
    raise SystemExit(main())
