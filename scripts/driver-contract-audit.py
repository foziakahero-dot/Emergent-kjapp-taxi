"""Verify Driver API wrapper paths against backend route decorators."""
import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
routes = []
for source in sorted((ROOT / "backend").rglob("*.py")):
    try:
        tree = ast.parse(source.read_text(encoding="utf-8"))
    except (SyntaxError, UnicodeDecodeError):
        continue
    for function in ast.walk(tree):
        if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in function.decorator_list:
            if (
                isinstance(decorator, ast.Call)
                and isinstance(decorator.func, ast.Attribute)
                and decorator.func.attr in {"get", "post", "put", "patch", "delete"}
                and decorator.args
                and isinstance(decorator.args[0], ast.Constant)
                and isinstance(decorator.args[0].value, str)
            ):
                routes.append((decorator.func.attr.upper(), decorator.args[0].value))


def path_pattern(path):
    parts = re.split(r"(\{[^{}]+\}|\$\{[^}]+\})", path)
    return "^" + "".join("[^/]+" if part.startswith(("{", "${")) else re.escape(part) for part in parts) + "$"


api_source = (ROOT / "driver-app" / "src" / "lib" / "api.ts").read_text(encoding="utf-8")
wrappers = []
for call in re.finditer(r"api\.(get|post|put|patch|delete)\(\s*(['\"`])(.+?)\2", api_source):
    method, _, client_path = call.groups()
    pattern = path_pattern(client_path)
    matching = [
        {"method": route_method, "path": route_path}
        for route_method, route_path in routes
        if route_method == method.upper() and re.fullmatch(pattern, route_path)
    ]
    wrappers.append(
        {
            "method": method.upper(),
            "path": client_path,
            "matches": matching,
            "status": "mapped" if matching else "unmapped",
        }
    )

unmapped = [wrapper for wrapper in wrappers if wrapper["status"] != "mapped"]
print(
    json.dumps(
        {
            "backend_routes": len(routes),
            "driver_api_wrappers": len(wrappers),
            "mapped": len(wrappers) - len(unmapped),
            "unmapped": unmapped,
        },
        ensure_ascii=False,
    )
)
raise SystemExit(1 if unmapped else 0)
