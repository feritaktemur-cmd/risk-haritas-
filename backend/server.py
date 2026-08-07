"""School Risk Maps - FastAPI backend.

Scope right now: establish and verify the Supabase connection (DB / Auth / Storage).
No tables, migrations, or schema changes are created here — the custom schema will be
implemented separately later.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from supabase_client import get_service_client, SUPABASE_URL

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("school_risk_maps")

app = FastAPI(title="School Risk Maps API")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"service": "School Risk Maps API", "status": "running"}


@api.get("/health")
async def health():
    return {"status": "ok"}


@api.get("/supabase/status")
async def supabase_status():
    """Verify the backend can reach the Supabase project.

    Uses the service (secret) client to list Storage buckets — a lightweight call
    that needs no application tables, so it works before any schema is created.
    """
    result = {
        "connected": False,
        "project_url": SUPABASE_URL,
        "auth": False,
        "storage": False,
        "buckets": [],
        "error": None,
    }
    try:
        client = get_service_client()

        # Storage reachability (no tables required)
        buckets = client.storage.list_buckets()
        result["storage"] = True
        result["buckets"] = [getattr(b, "name", None) or (b.get("name") if isinstance(b, dict) else str(b)) for b in buckets]

        # Auth admin reachability (service key)
        try:
            client.auth.admin.list_users()
            result["auth"] = True
        except Exception as auth_err:  # noqa: BLE001
            logger.warning("Supabase auth admin check failed: %s", auth_err)

        result["connected"] = True
    except Exception as e:  # noqa: BLE001
        logger.exception("Supabase connection check failed")
        result["error"] = str(e)

    return result


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
