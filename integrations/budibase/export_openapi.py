"""Export REST queries for Budibase, not a native Budibase application export."""
import json
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from gateway import Settings, create_app


def convert(value):
    if isinstance(value, list):
        return [convert(v) for v in value]
    if not isinstance(value, dict):
        return value
    value = {k: convert(v) for k, v in value.items()}
    # Pydantic emits JSON Schema null unions; Budibase's importer documents 3.0.
    union = value.get("anyOf", [])
    if len(union) == 2 and {"type": "null"} in union:
        concrete = next(v for v in union if v != {"type": "null"})
        value.pop("anyOf")
        if "$ref" in concrete:
            value["allOf"] = [concrete]
        else:
            value.update(concrete)
        value["nullable"] = True
    if "const" in value:
        value["enum"] = [value.pop("const")]
    for exclusive, bound in (("exclusiveMinimum", "minimum"), ("exclusiveMaximum", "maximum")):
        if exclusive in value and not isinstance(value[exclusive], bool):
            value[bound] = value[exclusive]
            value[exclusive] = True
    return value


def spec():
    # Transient test key, public part only. No authentication/connection is performed.
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key().public_bytes(serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    settings = Settings("https://issuer.example.invalid", "snar-admin-schema-export", public)
    document = convert(create_app(settings, repository=object()).openapi())
    document["openapi"] = "3.0.3"
    document["info"]["description"] = (
        "Isolated PostgreSQL adapter. Configure a verified gateway URL in Budibase. "
        "All data queries require an individual RS256 bearer JWT. No deployed gateway is implied.")
    return document


if __name__ == "__main__":
    output = Path(__file__).with_name("budibase-rest.openapi.json")
    output.write_text(json.dumps(spec(), ensure_ascii=False, indent=2) + "\n")
    print(f"Exported {output.name}")
