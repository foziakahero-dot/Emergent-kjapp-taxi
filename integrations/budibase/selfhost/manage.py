"""Start the free self-hosted edition on the host running this script.

No cloud subscription, database migration, or public deployment is performed.
Uses standard Python only. Never prints generated internal service credentials.
"""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SECRET_KEYS = ("JWT_SECRET", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "REDIS_PASSWORD",
               "COUCHDB_USER", "COUCHDB_PASSWORD", "INTERNAL_API_KEY")


def prepare(directory: Path):
    path = directory / ".env"
    if path.exists():
        # Existing credentials belong to the running installation; never rotate silently.
        values = dict(line.split("=", 1) for line in path.read_text().splitlines()
                      if line and not line.startswith("#") and "=" in line)
        if any(not values.get(key) for key in SECRET_KEYS):
            raise ValueError("Eksisterende .env mangler nødvendige verdier. Filen er ikke endret.")
        return False
    text = "# Generated locally. Never commit, share or print this file.\n"
    text += "\n".join(f"{key}={secrets.token_hex(32)}" for key in SECRET_KEYS) + "\n"
    # Exclusive create preserves an existing file even if another process started meanwhile.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write(text)
    return True


def command(*args):
    return ["docker", "compose", "--project-directory", str(ROOT),
            "--env-file", str(ROOT / ".env"), "-f", str(ROOT / "compose.yaml"), *args]


def run(action):
    if shutil.which("docker") is None:
        print("BLOCKED: Docker finnes ikke på denne maskinen. Installer/start en støttet Docker-motor først.", file=sys.stderr)
        return 2
    try:
        subprocess.run(["docker", "compose", "version"], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["docker", "info", "--format", "{{.ServerVersion}}"], check=True, stdout=subprocess.DEVNULL)
        if action == "start":
            prepare(ROOT)
            subprocess.run(command("config", "--quiet"), check=True)
            subprocess.run(command("up", "-d"), check=True)
            print("Container startet. Åpne http://localhost:10000 når oppstarten er ferdig.")
            print("Dette er lokal Community. Opprett admin i nettleseren; ingen passord er forhåndssatt.")
            print("App, PostgreSQL-tilkobling og tilgangskontroll må deretter importeres og testes.")
        elif not (ROOT / ".env").exists():
            print("Ingen lokal installasjon klargjort. Kjør start først.", file=sys.stderr)
            return 2
        else:
            subprocess.run(command("stop" if action == "stop" else "ps"), check=True)
        return 0
    except (subprocess.CalledProcessError, ValueError, FileExistsError):
        print("BLOCKED: Oppsettet ble ikke fullført. Kontroller Docker/status og lokale filer. Ingen database er migrert.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SNAR Budibase Community – lokal drift uten skyabonnement")
    parser.add_argument("action", choices=["start", "stop", "status"])
    sys.exit(run(parser.parse_args().action))
