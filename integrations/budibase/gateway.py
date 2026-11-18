"""Optional, isolated PostgreSQL admin adapter. Does not import SNAR's Mongo backend.

Only a verified per-person issuer/subject reaches the SQL authorization functions.
Do not replace this bearer token with a shared Budibase/admin API token.
"""
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, Literal

import jwt
import psycopg
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey
from fastapi import Depends, FastAPI, HTTPException, Query, Path as PathParameter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
from psycopg_pool import ConnectionPool


@dataclass(frozen=True)
class Settings:
    issuer: str
    audience: str
    public_key: str
    database_url: str = ""
    origins: tuple[str, ...] = ()

    def __post_init__(self):
        if not self.issuer.startswith("https://") or not self.audience:
            raise ValueError("HTTPS issuer and audience are required")
        key = load_pem_public_key(self.public_key.encode())
        if not isinstance(key, RSAPublicKey) or key.key_size < 2048:
            raise ValueError("An RSA public key of at least 2048 bits is required")
        if any(not x.startswith("https://") or "*" in x for x in self.origins):
            raise ValueError("Only exact HTTPS CORS origins are accepted")

    @classmethod
    def from_env(cls):
        return cls(issuer=os.environ["SNAR_ADMIN_JWT_ISSUER"],
            audience=os.environ["SNAR_ADMIN_JWT_AUDIENCE"],
            public_key=Path(os.environ["SNAR_ADMIN_JWT_PUBLIC_KEY_FILE"]).read_text(),
            database_url=os.environ["SNAR_ADMIN_DATABASE_URL"],
            origins=tuple(x.strip() for x in os.getenv("SNAR_ADMIN_CORS_ORIGINS", "").split(",") if x.strip()))


@dataclass(frozen=True)
class Identity:
    issuer: str
    subject: str


# Fixed statements only. Caller cannot select a SQL function or inject an actor id.
STATEMENTS = {
    "me": "SELECT snar_admin.me()",
    "dashboard": "SELECT snar_admin.dashboard()",
    "drivers": "SELECT snar_admin.drivers(%s,%s,%s,%s)",
    "vehicles": "SELECT snar_admin.vehicles(%s,%s,%s)",
    "prices": "SELECT snar_admin.prices()",
    "active_rides": "SELECT snar_admin.active_rides()",
    "my_vehicles": "SELECT snar_admin.my_vehicles()",
    "my_rides": "SELECT snar_admin.my_rides(%s,%s)",
    "set_driver_status": "SELECT snar_admin.set_driver_status(%s,%s,%s,%s)",
    "set_vehicle_status": "SELECT snar_admin.set_vehicle_status(%s,%s,%s,%s)",
    "save_price": "SELECT snar_admin.save_price(%s,%s,%s::jsonb)",
}


class PostgresRepository:
    def __init__(self, dsn: str):
        if not dsn:
            raise ValueError("A separate, least-privilege PostgreSQL login is required")
        self.pool = ConnectionPool(dsn, min_size=1, max_size=5, timeout=5, open=False,
            kwargs={"connect_timeout": 5})

    def open(self):
        self.pool.open(wait=True, timeout=10)
        # Validate actual login: never run this gateway using a schema-owner credential.
        with self.pool.connection() as c, c.transaction(), c.cursor() as cur:
            cur.execute("""SELECT r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb
                OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                    WHERE c.relkind IN ('r','p') AND ((n.nspname='public' AND c.relname IN
                    ('users','drivers','vehicles','pricing_zones','rides')) OR n.nspname='snar_admin')
                    AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
                FROM pg_roles r WHERE r.rolname=current_user""")
            if cur.fetchone()[0]:
                raise RuntimeError("Gateway database login has excessive privileges")
            cur.execute("SET LOCAL ROLE snar_bb_gateway")

    def close(self):
        self.pool.close()

    def execute(self, identity: Identity, operation: str, args: tuple = ()):
        # Psycopg's transaction manager commits data+audit together; on error it rolls back
        # and discards SET LOCAL identity before returning the connection to the pool.
        statement = STATEMENTS[operation]
        with self.pool.connection() as c, c.transaction(), c.cursor() as cur:
            cur.execute("SET LOCAL ROLE snar_bb_gateway")
            cur.execute("SET LOCAL statement_timeout = '5s'")
            cur.execute("SET LOCAL lock_timeout = '2s'")
            cur.execute("SELECT set_config('snar.auth_issuer',%s,true),set_config('snar.auth_subject',%s,true)",
                (identity.issuer, identity.subject))
            cur.execute(statement, args)
            return cur.fetchone()[0]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


Version = Annotated[int, Field(ge=0, le=9223372036854775807)]
Money = Annotated[int, Field(ge=0, le=2147483647)]
Class = Literal["SNAR", "PREMIUM", "SUV", "XL"]
Status = Literal["all", "pending", "approved", "rejected", "suspended"]


class DriverAction(StrictModel):
    version: Version
    action: Literal["approved", "rejected", "suspended"]
    reason: Annotated[str | None, Field(max_length=2000)] = None


class VehicleAction(StrictModel):
    version: Version
    action: Literal["approved", "rejected"]
    reason: Annotated[str | None, Field(max_length=2000)] = None


class PriceValues(StrictModel):
    base_fare: Money
    per_km: Money
    per_minute: Money
    minimum_fare: Money
    night_surcharge: Money
    rush_hour_surcharge: Money
    is_active: bool


class PriceUpdate(StrictModel):
    version: Version
    values: PriceValues


def create_app(settings: Settings, repository=None) -> FastAPI:
    repo = repository if repository is not None else PostgresRepository(settings.database_url)

    @asynccontextmanager
    async def lifespan(app):
        repo.open()
        try:
            yield
        finally:
            repo.close()

    app = FastAPI(title="SNAR PostgreSQL Admin Adapter", version="0.1.0", lifespan=lifespan)
    # OpenAPI 3.0 export is generated separately for Budibase's REST query importer.
    if settings.origins:
        app.add_middleware(CORSMiddleware, allow_origins=list(settings.origins),
            allow_methods=["GET", "POST", "PUT"], allow_headers=["Authorization", "Content-Type"])
    bearer = HTTPBearer(auto_error=False)

    def authenticate(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
        try:
            if credentials is None:
                raise ValueError("missing bearer")
            claims = jwt.decode(credentials.credentials, settings.public_key, algorithms=["RS256"],
                issuer=settings.issuer, audience=settings.audience,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]})
            if not isinstance(claims["sub"], str) or not 1 <= len(claims["sub"]) <= 255:
                raise ValueError("invalid subject")
            if claims["exp"] - claims["iat"] > 1800:
                raise ValueError("token lifetime exceeds 30 minutes")
            return Identity(settings.issuer, claims["sub"])
        except (jwt.PyJWTError, ValueError, TypeError):
            raise HTTPException(401, "Logg inn på nytt", headers={"WWW-Authenticate": "Bearer"}) from None

    Actor = Annotated[Identity, Depends(authenticate)]

    def execute(identity, operation, args=()):
        try:
            return repo.execute(identity, operation, args)
        except psycopg.Error as e:
            errors = {"42501": (403, "Tilgang nektet"), "P0002": (404, "Ikke funnet"),
                "40001": (409, "Data er endret. Oppdater visningen."),
                "22023": (422, "Kontroller felter, dokumentdatoer og statusovergang")}
            status, message = errors.get(e.sqlstate, (503, "Kan ikke oppdatere data akkurat nå. Prøv igjen."))
            raise HTTPException(status, message) from None
        except TimeoutError:
            raise HTTPException(503, "Kan ikke oppdatere data akkurat nå. Prøv igjen.") from None

    @app.middleware("http")
    async def private_response(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health", operation_id="health")
    def health():
        return {"status": "ok", "service": "snar-postgres-admin-adapter"}

    @app.get("/me", operation_id="me")
    def me(actor: Actor):
        return execute(actor, "me")

    @app.get("/admin/dashboard", operation_id="dashboard")
    def dashboard(actor: Actor):
        return execute(actor, "dashboard")

    @app.get("/admin/drivers", operation_id="drivers")
    def drivers(actor: Actor, status: Status = "pending", search: Annotated[str, Query(max_length=100)] = "",
            limit: Annotated[int, Query(ge=1, le=100)] = 25, offset: Annotated[int, Query(ge=0)] = 0):
        return execute(actor, "drivers", (status, search, limit, offset))

    @app.post("/admin/drivers/{driver_id}/status", operation_id="set_driver_status")
    def driver_status(driver_id: Annotated[int, PathParameter(gt=0)], body: DriverAction, actor: Actor):
        return execute(actor, "set_driver_status", (driver_id, body.version, body.action, body.reason))

    @app.get("/admin/vehicles", operation_id="vehicles")
    def vehicles(actor: Actor, status: Status = "pending", limit: Annotated[int, Query(ge=1, le=100)] = 25,
            offset: Annotated[int, Query(ge=0)] = 0):
        return execute(actor, "vehicles", (status, limit, offset))

    @app.post("/admin/vehicles/{vehicle_id}/status", operation_id="set_vehicle_status")
    def vehicle_status(vehicle_id: Annotated[int, PathParameter(gt=0)], body: VehicleAction, actor: Actor):
        return execute(actor, "set_vehicle_status", (vehicle_id, body.version, body.action, body.reason))

    @app.get("/admin/prices", operation_id="prices")
    def prices(actor: Actor):
        return execute(actor, "prices")

    @app.put("/admin/prices/{vehicle_class}", operation_id="save_price")
    def price_update(vehicle_class: Class, body: PriceUpdate, actor: Actor):
        return execute(actor, "save_price", (vehicle_class, body.version, body.values.model_dump_json()))

    @app.get("/admin/rides/active", operation_id="active_rides")
    def active_rides(actor: Actor):
        return execute(actor, "active_rides")

    @app.get("/driver/vehicles", operation_id="my_vehicles")
    def my_vehicles(actor: Actor):
        return execute(actor, "my_vehicles")

    @app.get("/driver/rides", operation_id="my_rides")
    def my_rides(actor: Actor, limit: Annotated[int, Query(ge=1, le=100)] = 25,
            offset: Annotated[int, Query(ge=0)] = 0):
        return execute(actor, "my_rides", (limit, offset))

    return app


def app_factory():
    return create_app(Settings.from_env())
