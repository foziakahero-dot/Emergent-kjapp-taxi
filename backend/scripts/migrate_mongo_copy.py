#!/usr/bin/env python3
"""Safe MongoDB copy migration for KJAPP.

Default mode is DRY RUN. Nothing is written unless --apply is supplied.
Source is never mutated. Target collections are upserted by _id; target is never dropped.
Indexes are copied best-effort after documents so the migration is repeatable.

Required environment:
  SOURCE_MONGO_URL
  SOURCE_DB_NAME
  TARGET_MONGO_URL
  TARGET_DB_NAME

Examples:
  python backend/scripts/migrate_mongo_copy.py
  python backend/scripts/migrate_mongo_copy.py --apply
  python backend/scripts/migrate_mongo_copy.py --apply --collections users trips fleets
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Iterable

from pymongo import MongoClient, ReplaceOne
from pymongo.errors import PyMongoError

SYSTEM_COLLECTION_PREFIXES = ("system.",)
DEFAULT_BATCH_SIZE = 500


def env_required(name: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def visible_collections(db) -> list[str]:
    return sorted(
        name
        for name in db.list_collection_names()
        if not name.startswith(SYSTEM_COLLECTION_PREFIXES)
    )


def copy_indexes(source_coll, target_coll, apply: bool) -> tuple[int, list[str]]:
    created = 0
    warnings: list[str] = []
    for name, spec in source_coll.index_information().items():
        if name == "_id_":
            continue
        keys = spec.get("key")
        if not keys:
            continue
        options = {
            k: v for k, v in spec.items()
            if k not in {"v", "key", "ns"}
        }
        options.pop("name", None)
        if not apply:
            created += 1
            continue
        try:
            target_coll.create_index(keys, name=name, **options)
            created += 1
        except Exception as exc:
            warnings.append(f"{source_coll.name}:{name}: {exc}")
    return created, warnings


def migrate_collection(source_db, target_db, name: str, apply: bool, batch_size: int) -> dict:
    source = source_db[name]
    target = target_db[name]
    source_count = source.count_documents({})
    target_before = target.count_documents({}) if apply else None

    scanned = 0
    written = 0
    ops: list[ReplaceOne] = []

    for doc in source.find({}).batch_size(batch_size):
        scanned += 1
        if not apply:
            continue
        ops.append(ReplaceOne({"_id": doc["_id"]}, doc, upsert=True))
        if len(ops) >= batch_size:
            result = target.bulk_write(ops, ordered=False)
            written += result.modified_count + result.upserted_count
            ops.clear()

    if apply and ops:
        result = target.bulk_write(ops, ordered=False)
        written += result.modified_count + result.upserted_count

    index_count, index_warnings = copy_indexes(source, target, apply)
    target_after = target.count_documents({}) if apply else None

    return {
        "collection": name,
        "source_count": source_count,
        "scanned": scanned,
        "written_or_updated": written,
        "target_before": target_before,
        "target_after": target_after,
        "indexes_seen": index_count,
        "index_warnings": index_warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write to target. Default is dry-run.")
    parser.add_argument("--collections", nargs="*", default=None)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    args = parser.parse_args()

    source_url = env_required("SOURCE_MONGO_URL")
    source_db_name = env_required("SOURCE_DB_NAME")
    target_url = env_required("TARGET_MONGO_URL")
    target_db_name = env_required("TARGET_DB_NAME")

    if source_url == target_url and source_db_name == target_db_name:
        raise SystemExit("Refusing to migrate: source and target are identical.")

    source_client = MongoClient(source_url, serverSelectionTimeoutMS=15000)
    target_client = MongoClient(target_url, serverSelectionTimeoutMS=15000)
    try:
        source_client.admin.command("ping")
        target_client.admin.command("ping")
        source_db = source_client[source_db_name]
        target_db = target_client[target_db_name]

        all_source = visible_collections(source_db)
        requested = args.collections or all_source
        missing = sorted(set(requested) - set(all_source))
        if missing:
            raise SystemExit(f"Source collections not found: {', '.join(missing)}")

        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"KJAPP Mongo copy migration — {mode}")
        print(f"Source DB: {source_db_name}")
        print(f"Target DB: {target_db_name}")
        print(f"Collections: {len(requested)}")

        failures = 0
        total_docs = 0
        for name in requested:
            try:
                result = migrate_collection(
                    source_db,
                    target_db,
                    name,
                    apply=args.apply,
                    batch_size=max(1, args.batch_size),
                )
                total_docs += result["source_count"]
                print(
                    f"{name}: source={result['source_count']} "
                    f"target_before={result['target_before']} "
                    f"target_after={result['target_after']} "
                    f"indexes={result['indexes_seen']}"
                )
                for warning in result["index_warnings"]:
                    print(f"WARN index: {warning}")
            except PyMongoError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}", file=sys.stderr)

        print(f"RESULT: collections={len(requested)} documents={total_docs} failures={failures}")
        return 1 if failures else 0
    finally:
        source_client.close()
        target_client.close()


if __name__ == "__main__":
    raise SystemExit(main())
