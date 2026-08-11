"""School Risk Maps - FastAPI backend.

Scope right now: establish and verify the Supabase connection (DB / Auth / Storage).
No tables, migrations, or schema changes are created here — the custom schema will be
implemented separately later.
"""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from supabase_client import get_service_client, SUPABASE_URL
from excel_preview import analyze_rows, load_reference, plan_import, VALID_MANAGEMENT_TYPES
from admin_accounts import generate_username, generate_temp_password, synth_email_for

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


def _get_bearer_token(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


def _require_general_admin(request: Request):
    """Server-side authoritative General Admin gate.

    Returns (auth_user_id, profile) or raises HTTPException. Used by all
    /api/admin/* endpoints. Frontend checks are never trusted.
    """
    token = _get_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Oturum bulunamadı.")
    client = get_service_client()
    try:
        user_resp = client.auth.get_user(token)
        user = getattr(user_resp, "user", None)
    except Exception:  # noqa: BLE001
        user = None
    if user is None or not getattr(user, "id", None):
        raise HTTPException(status_code=401, detail="Oturum geçersiz.")
    try:
        rows = (
            client.table("admin_profiles")
            .select("full_name,role,is_active")
            .eq("auth_user_id", user.id)
            .limit(1)
            .execute()
            .data
        )
    except Exception:  # noqa: BLE001
        logger.exception("admin_profiles lookup failed")
        raise HTTPException(status_code=500, detail="Yetki kontrolü yapılamadı.")
    prof = rows[0] if rows else None
    if prof is None or not prof.get("is_active") or prof.get("role") != "general_admin":
        raise HTTPException(status_code=403, detail="Bu hesabın yönetim erişimi yok.")
    return user.id, prof


@api.get("/admin/me")
async def admin_me(request: Request):
    """Server-side authoritative check for General Admin access."""
    _uid, prof = _require_general_admin(request)
    return {"full_name": prof["full_name"], "role": prof["role"]}


@api.get("/admin/districts")
async def admin_districts(request: Request):
    _require_general_admin(request)
    client = get_service_client()
    rows = client.table("districts").select("id,name").eq("is_active", True).order("name").execute().data
    return {"districts": rows}


def _fetch_all(build):
    """Range-paginate a PostgREST query built by `build(start, end)`."""
    out = []
    start, step = 0, 1000
    while True:
        data = build(start, start + step - 1).execute().data
        out.extend(data)
        if len(data) < step:
            break
        start += step
    return out


@api.get("/admin/school-accounts")
async def admin_school_accounts(request: Request, district_id: int = None, q: str = None, status: str = "all"):
    """List schools with their account status. Filters: district_id, q (name), status."""
    _require_general_admin(request)
    client = get_service_client()

    sel = ("id,name,district_id,"
           "district:districts(name),"
           "education_level:education_levels(name),"
           "management_type:management_types(name),"
           "school_type:school_types(name)")

    def build_schools(a, b):
        qb = client.table("schools").select(sel)
        if district_id is not None:
            qb = qb.eq("district_id", district_id)
        if q:
            qb = qb.ilike("name", f"%{q}%")
        return qb.order("name").range(a, b)

    schools = _fetch_all(build_schools)

    accounts = _fetch_all(
        lambda a, b: client.table("school_accounts").select("school_id,username,is_active").range(a, b)
    )
    acc_by_school = {r["school_id"]: r for r in accounts}

    items = []
    for s in schools:
        acc = acc_by_school.get(s["id"])
        has_account = acc is not None
        if status == "has" and not has_account:
            continue
        if status == "none" and has_account:
            continue
        items.append({
            "school_id": s["id"],
            "name": s["name"],
            "district": (s.get("district") or {}).get("name"),
            "education_level": (s.get("education_level") or {}).get("name"),
            "school_type": (s.get("school_type") or {}).get("name"),
            "management_type": (s.get("management_type") or {}).get("name"),
            "has_account": has_account,
            "username": acc["username"] if has_account else None,
            "account_active": acc["is_active"] if has_account else None,
        })

    total = len(items)
    with_acc = sum(1 for i in items if i["has_account"])
    return {"summary": {"total": total, "with_account": with_acc, "without_account": total - with_acc}, "items": items}


@api.post("/admin/school-accounts")
async def create_school_account(request: Request):
    """Create a Supabase Auth user + school_accounts row for a school without one.

    Backend-only (service client). Atomic-ish: if the DB row fails after the
    Auth user is created, the Auth user is deleted (no orphan). Returns the
    temp password ONCE; it is never stored in any application table.
    """
    _require_general_admin(request)
    body = await request.json()
    school_id = (body or {}).get("school_id")
    if not school_id:
        raise HTTPException(status_code=400, detail="school_id gerekli.")

    client = get_service_client()

    # 1) School must exist.
    srows = client.table("schools").select("id,name,district:districts(name)").eq("id", school_id).limit(1).execute().data
    if not srows:
        raise HTTPException(status_code=404, detail="Okul bulunamadı.")
    school = srows[0]
    school_name = school["name"]
    district_name = (school.get("district") or {}).get("name") or ""

    # 2) No existing account for this school.
    existing_for_school = client.table("school_accounts").select("id").eq("school_id", school_id).limit(1).execute().data
    if existing_for_school:
        raise HTTPException(status_code=409, detail="Bu okulun zaten bir hesabı var.")

    # 3) Unique (case-insensitive) username.
    existing_usernames = _fetch_all(
        lambda a, b: client.table("school_accounts").select("username").range(a, b)
    )
    existing_lower = {r["username"].lower() for r in existing_usernames}
    username = generate_username(school_name, district_name, existing_lower)

    # 4) Strong temp password + synthetic emailless identity.
    temp_password = generate_temp_password()
    synth_email = synth_email_for(username)

    # 5) Create Auth user.
    try:
        created = client.auth.admin.create_user({
            "email": synth_email,
            "password": temp_password,
            "email_confirm": True,
            "user_metadata": {"username": username, "school_id": school_id, "kind": "school"},
        })
        auth_user = getattr(created, "user", None)
        auth_user_id = getattr(auth_user, "id", None)
    except Exception as e:  # noqa: BLE001
        logger.exception("Auth user creation failed")
        raise HTTPException(status_code=500, detail=f"Auth kullanıcısı oluşturulamadı: {e}")
    if not auth_user_id:
        raise HTTPException(status_code=500, detail="Auth kullanıcısı oluşturulamadı.")

    # 6) Insert school_accounts row; on failure, clean up the Auth user.
    try:
        client.table("school_accounts").insert({
            "school_id": school_id,
            "auth_user_id": auth_user_id,
            "username": username,
            "is_active": True,
            "must_change_password": True,
        }).execute()
    except Exception as e:  # noqa: BLE001
        logger.exception("school_accounts insert failed; rolling back Auth user")
        try:
            client.auth.admin.delete_user(auth_user_id)
        except Exception:  # noqa: BLE001
            logger.exception("Auth user cleanup failed (orphan risk)")
        raise HTTPException(status_code=500, detail=f"Hesap kaydı oluşturulamadı, işlem geri alındı: {e}")

    # 7) Return the credentials ONCE (password never persisted in app tables).
    return {
        "school_name": school_name,
        "username": username,
        "temp_password": temp_password,
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
