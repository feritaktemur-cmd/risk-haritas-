"""School Risk Maps - FastAPI backend.

Scope right now: establish and verify the Supabase connection (DB / Auth / Storage).
No tables, migrations, or schema changes are created here — the custom schema will be
implemented separately later.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from supabase_client import get_service_client, SUPABASE_URL
from excel_preview import analyze_rows, load_reference, VALID_MANAGEMENT_TYPES

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


@api.post("/schools/preview")
async def schools_preview(
    file: UploadFile = File(...),
    management_type: str = Form(...),
):
    """Analyze an uploaded Excel file and return a PREVIEW only.

    READ-ONLY: reads districts & school_types for validation. Writes NOTHING
    to the database. No schools are created here.
    """
    if management_type not in VALID_MANAGEMENT_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz yönetim türü. 'Resmî' veya 'Özel' olmalı.")

    fname = (file.filename or "").lower()
    if not (fname.endswith(".xlsx") or fname.endswith(".xlsm")):
        raise HTTPException(status_code=400, detail="Lütfen bir Excel dosyası (.xlsx) yükleyin.")

    content = await file.read()

    try:
        districts, school_types = load_reference()
    except Exception as e:  # noqa: BLE001
        logger.exception("Reference load failed")
        raise HTTPException(
            status_code=400,
            detail=(
                "Referans tabloları okunamadı (districts / school_types). "
                "Ön izleme için Migration 002 (districts) ve 001+005 (school_types + seed) "
                f"uygulanmış olmalıdır. Ayrıntı: {e}"
            ),
        )

    try:
        result = analyze_rows(content, management_type, districts, school_types)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("Excel analysis failed")
        raise HTTPException(status_code=400, detail=f"Excel çözümlenemedi: {e}")

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    return result


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
