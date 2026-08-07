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
from excel_preview import analyze_rows, load_reference, plan_import, VALID_MANAGEMENT_TYPES

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


@api.post("/schools/import")
async def schools_import(
    file: UploadFile = File(...),
    management_type: str = Form(...),
):
    """Securely import ONLY loadable rows into the schools table.

    Backend-only (uses the service client). Never exposes the secret key.
    Refuses to start if there are HATALI İLÇE / HATALI OKUL TÜRÜ rows.
    Duplicate = (normalized name, district_id, mernis_address_code); such rows
    are skipped and reported as ZATEN MEVCUT (MERNIS alone is not a duplicate).
    """
    if management_type not in VALID_MANAGEMENT_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz yönetim türü. 'Resmî' veya 'Özel' olmalı.")

    fname = (file.filename or "").lower()
    if not (fname.endswith(".xlsx") or fname.endswith(".xlsm")):
        raise HTTPException(status_code=400, detail="Lütfen bir Excel dosyası (.xlsx) yükleyin.")

    content = await file.read()
    client = get_service_client()

    try:
        districts = client.table("districts").select("id,name,is_active").execute().data
        school_types = client.table("school_types").select("id,name,is_active,education_level_id").execute().data
        management_types = client.table("management_types").select("id,name").execute().data
        existing_schools = client.table("schools").select("id,name,district_id,mernis_address_code").execute().data
    except Exception as e:  # noqa: BLE001
        logger.exception("Reference/existing load failed")
        raise HTTPException(status_code=400, detail=f"Referans/mevcut okul verisi okunamadı: {e}")

    plan = plan_import(content, management_type, districts, school_types, management_types, existing_schools)
    if plan.get("error"):
        raise HTTPException(status_code=400, detail=plan["error"])

    s = plan["summary"]
    if s["invalid_district"] > 0 or s["invalid_school_type"] > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Aktarım başlatılamaz: {s['invalid_district']} hatalı ilçe, "
                f"{s['invalid_school_type']} hatalı okul türü var. Önce düzeltin."
            ),
        )

    to_insert = plan["to_insert"]
    inserted = 0
    if to_insert:
        try:
            # Single bulk INSERT statement = atomic (all-or-nothing).
            resp = client.table("schools").insert(to_insert).execute()
            inserted = len(resp.data or [])
        except Exception as e:  # noqa: BLE001
            logger.exception("Bulk insert failed")
            raise HTTPException(status_code=500, detail=f"Aktarım sırasında hata oluştu, hiçbir kayıt yazılmadı: {e}")

    for idx in plan["insert_row_refs"]:
        plan["rows"][idx]["status"] = "EKLENDİ"

    total = s["total"]
    summary = {
        "total": total,
        "inserted": inserted,
        "already_exists": s["already_exists"],
        "out_of_scope": s["out_of_scope"],
        "error": s["error"],
        "skipped": total - inserted,
    }
    return {"management_type": management_type, "summary": summary, "rows": plan["rows"]}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
