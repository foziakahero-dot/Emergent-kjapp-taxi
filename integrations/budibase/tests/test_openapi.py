from openapi_spec_validator import validate
from export_openapi import spec


def test_openapi_is_valid_3_0_import_contract():
    document = spec()
    validate(document)
    assert document["openapi"] == "3.0.3"
    assert len(document["paths"]) == 12
    operations = [op for path in document["paths"].values() for op in path.values()]
    assert len({op["operationId"] for op in operations}) == len(operations)
    assert all(op.get("security") for op in operations if op["operationId"] != "health")
