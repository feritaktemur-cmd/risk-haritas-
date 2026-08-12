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

from supabase_client import get_service_client, get_anon_client, SUPABASE_URL
from excel_preview import analyze_rows, load_reference, plan_import, VALID_MANAGEMENT_TYPES
from admin_accounts import generate_username, generate_temp_password, synth_email_for
import re as _re


def _valid_school_password(pw: str):
    """>=8 chars, at least 1 letter and 1 digit."""
    return bool(pw) and len(pw) >= 8 and _re.search(r"[A-Za-z]", pw) and _re.search(r"\d", pw)


def _resolve_school_by_token(request: Request):
    """Validate token -> active school_accounts row. Raises HTTPException.

    Returns (auth_user_id, account_row). Used by school-side protected endpoints.
    Generic messages; no leakage of existence.
    """
    token = _get_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Oturum bulunamadı.")
    client = get_service_client()
    try:
        user = getattr(client.auth.get_user(token), "user", None)
    except Exception:  # noqa: BLE001
        user = None
    if user is None or not getattr(user, "id", None):
        raise HTTPException(status_code=401, detail="Oturum geçersiz.")
    rows = (
        client.table("school_accounts")
        .select("id,school_id,username,is_active,must_change_password")
        .eq("auth_user_id", user.id)
        .limit(1)
        .execute()
        .data
    )
    acc = rows[0] if rows else None
    if acc is None or not acc.get("is_active"):
        raise HTTPException(status_code=403, detail="Bu hesapla giriş yapılamıyor. Lütfen RAM ile iletişime geçin.")
    return user.id, acc


def _school_display(client, school_id):
    rows = client.table("schools").select("name,district:districts(name)").eq("id", school_id).limit(1).execute().data
    if not rows:
        return {"school_name": None, "district": None}
    return {"school_name": rows[0]["name"], "district": (rows[0].get("district") or {}).get("name")}

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


@api.post("/school/login")
async def school_login(request: Request):
    """Username + password login for school accounts.

    Resolves the visible username to the synthetic (hidden) Auth email,
    verifies password via Supabase Auth, and returns session tokens.
    Generic errors; account existence is not leaked. Secret key stays backend.
    """
    body = await request.json()
    username = (body or {}).get("username", "")
    password = (body or {}).get("password", "")
    username_norm = str(username).strip().lower()
    if not username_norm or not password:
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı.")

    client = get_service_client()
    rows = (
        client.table("school_accounts")
        .select("id,school_id,username,is_active,must_change_password")
        .eq("username", username_norm)
        .limit(1)
        .execute()
        .data
    )
    acc = rows[0] if rows else None
    if acc is None:
        # Do not leak whether the username exists.
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı.")
    if not acc.get("is_active"):
        raise HTTPException(status_code=403, detail="Bu hesapla giriş yapılamıyor. Lütfen RAM ile iletişime geçin.")

    # Resolve the hidden synthetic email deterministically from the username.
    synth_email = synth_email_for(acc["username"])

    # Verify password via Supabase Auth using the anon (publishable) client.
    anon = get_anon_client()
    try:
        auth_res = anon.auth.sign_in_with_password({"email": synth_email, "password": password})
        session = getattr(auth_res, "session", None)
    except Exception:  # noqa: BLE001
        session = None
    if session is None or not getattr(session, "access_token", None):
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı.")

    disp = _school_display(client, acc["school_id"])
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "must_change_password": bool(acc.get("must_change_password")),
        "school_name": disp["school_name"],
        "district": disp["district"],
    }


@api.get("/school/session")
async def school_session(request: Request):
    """Session info for routing (works even if must_change_password=true)."""
    _uid, acc = _resolve_school_by_token(request)
    client = get_service_client()
    disp = _school_display(client, acc["school_id"])
    return {
        "must_change_password": bool(acc.get("must_change_password")),
        "school_name": disp["school_name"],
        "district": disp["district"],
    }


@api.get("/school/panel")
async def school_panel(request: Request):
    """Panel data. SERVER-SIDE gate: denied if must_change_password=true."""
    _uid, acc = _resolve_school_by_token(request)
    if acc.get("must_change_password"):
        raise HTTPException(status_code=403, detail="password_change_required")
    client = get_service_client()
    disp = _school_display(client, acc["school_id"])
    return {"school_name": disp["school_name"], "district": disp["district"]}


@api.post("/school/change-password")
async def school_change_password(request: Request):
    """Change password for the logged-in active school account (server-side)."""
    auth_user_id, acc = _resolve_school_by_token(request)
    body = await request.json()
    new_password = (body or {}).get("new_password", "")
    if not _valid_school_password(new_password):
        raise HTTPException(status_code=400, detail="Şifreniz en az 8 karakter olmalı ve en az bir harf ile bir rakam içermelidir.")

    client = get_service_client()
    # Update password in Supabase Auth (admin API, service key).
    try:
        client.auth.admin.update_user_by_id(auth_user_id, {"password": new_password})
    except Exception as e:  # noqa: BLE001
        logger.exception("Password update failed")
        raise HTTPException(status_code=500, detail="Şifre güncellenemedi.")

    # Clear the mandatory-change flag.
    try:
        client.table("school_accounts").update({"must_change_password": False}).eq("id", acc["id"]).execute()
    except Exception as e:  # noqa: BLE001
        logger.exception("must_change_password update failed")
        raise HTTPException(status_code=500, detail="Şifre güncellendi ancak durum güncellenemedi. Lütfen tekrar giriş yapın.")

    return {"ok": True}


def _require_school_ready(request: Request):
    """Active school account that has completed mandatory password change.

    Returns (auth_user_id, account_row). Raises 403 'password_change_required'
    if must_change_password is still true.
    """
    auth_user_id, acc = _resolve_school_by_token(request)
    if acc.get("must_change_password"):
        raise HTTPException(status_code=403, detail="password_change_required")
    return auth_user_id, acc


def _school_context(client, school_id):
    rows = (
        client.table("schools")
        .select("name,education_level:education_levels(name),district:districts(name)")
        .eq("id", school_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return {"school_name": None, "district": None, "education_level": None, "is_preschool": False}
    r = rows[0]
    edu = (r.get("education_level") or {}).get("name")
    return {
        "school_name": r["name"],
        "district": (r.get("district") or {}).get("name"),
        "education_level": edu,
        "is_preschool": edu == "Okul Öncesi",
    }


@api.get("/school/classes")
async def school_classes_list(request: Request):
    """List the logged-in school's own classes (scoped by token->school_id)."""
    _uid, acc = _require_school_ready(request)
    client = get_service_client()
    ctx = _school_context(client, acc["school_id"])
    rows = (
        client.table("school_classes")
        .select("id,level,branch")
        .eq("school_id", acc["school_id"])
        .order("level")
        .order("branch")
        .execute()
        .data
    )
    level_options = [4, 5] if ctx["is_preschool"] else list(range(1, 13))
    return {
        "school_name": ctx["school_name"],
        "district": ctx["district"],
        "is_preschool": ctx["is_preschool"],
        "level_options": level_options,
        "classes": rows,
    }


@api.post("/school/classes")
async def school_classes_create(request: Request):
    """Create a class for the logged-in school. school_id is derived server-side."""
    _uid, acc = _require_school_ready(request)
    body = await request.json()
    level = (body or {}).get("level")
    branch = (body or {}).get("branch")

    # Branch: exactly one uppercase Latin letter.
    if not isinstance(branch, str) or not _re.fullmatch(r"[A-Z]", branch):
        raise HTTPException(status_code=400, detail="Şube yalnızca tek bir büyük harf (A-Z) olabilir.")

    # Level: integer, range depends on preschool status.
    try:
        level = int(level)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Geçersiz seviye.")

    client = get_service_client()
    ctx = _school_context(client, acc["school_id"])
    if ctx["is_preschool"]:
        if level not in (4, 5):
            raise HTTPException(status_code=400, detail="Anaokulu için yaş grubu yalnızca 4 veya 5 olabilir.")
    else:
        if not (1 <= level <= 12):
            raise HTTPException(status_code=400, detail="Sınıf seviyesi 1 ile 12 arasında olmalıdır.")

    # Friendly duplicate handling (UNIQUE (school_id, level, branch)).
    existing = (
        client.table("school_classes")
        .select("id")
        .eq("school_id", acc["school_id"])
        .eq("level", level)
        .eq("branch", branch)
        .limit(1)
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail="Bu sınıf zaten tanımlı.")

    try:
        inserted = (
            client.table("school_classes")
            .insert({"school_id": acc["school_id"], "level": level, "branch": branch})
            .execute()
            .data
        )
    except Exception:  # noqa: BLE001
        logger.exception("class insert failed")
        # Likely a race on the UNIQUE constraint; keep the message friendly.
        raise HTTPException(status_code=409, detail="Bu sınıf zaten tanımlı.")

    row = inserted[0] if inserted else {"level": level, "branch": branch}
    return {"id": row.get("id"), "level": level, "branch": branch}


@api.delete("/school/classes/{class_id}")
async def school_classes_delete(class_id: str, request: Request):
    """Delete a class, but only if it belongs to the logged-in school."""
    _uid, acc = _require_school_ready(request)
    client = get_service_client()

    rows = client.table("school_classes").select("id,school_id").eq("id", class_id).limit(1).execute().data
    row = rows[0] if rows else None
    if row is None or row["school_id"] != acc["school_id"]:
        # Do not reveal other schools' classes.
        raise HTTPException(status_code=404, detail="Sınıf bulunamadı.")

    try:
        client.table("school_classes").delete().eq("id", class_id).eq("school_id", acc["school_id"]).execute()
    except Exception:  # noqa: BLE001
        logger.exception("class delete failed")
        raise HTTPException(status_code=409, detail="Bu sınıf silinemedi.")
    return {"ok": True}


def _active_academic_year(client):
    """Resolve the single active academic year via academic_years.is_active.

    Migration 001 guarantees at most one active year (partial unique index).
    Returns the row {id,name} or None if none is marked active.
    """
    rows = (
        client.table("academic_years")
        .select("id,name")
        .eq("is_active", True)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


@api.get("/school/students")
async def school_students_list(request: Request, q: str = None):
    """List the logged-in school's students for the active academic year.

    Scoped strictly by token->school_id. Also returns the school's own
    classes (for the add form) and the active year. Optional simple search
    over student_number / first_name / last_name.
    """
    _uid, acc = _require_school_ready(request)
    client = get_service_client()
    school_id = acc["school_id"]
    ctx = _school_context(client, school_id)

    year = _active_academic_year(client)
    if year is None:
        raise HTTPException(status_code=409, detail="Aktif eğitim yılı belirlenemedi. Lütfen RAM ile iletişime geçin.")

    # School's own classes (for the add-student dropdown).
    classes = (
        client.table("school_classes")
        .select("id,level,branch")
        .eq("school_id", school_id)
        .order("level")
        .order("branch")
        .execute()
        .data
    )

    # Students of this school (optional search).
    qb = client.table("students").select("id,student_number,first_name,last_name,status").eq("school_id", school_id)
    term = (q or "").strip()
    if term:
        safe = term.replace(",", " ").replace("%", "").replace("(", "").replace(")", "")
        qb = qb.or_(
            f"student_number.ilike.%{safe}%,first_name.ilike.%{safe}%,last_name.ilike.%{safe}%"
        )
    students = qb.order("last_name").order("first_name").execute().data

    # Current-year enrollments -> class label per student.
    enr = (
        client.table("student_class_enrollments")
        .select("student_id,school_class:school_classes(level,branch)")
        .eq("school_id", school_id)
        .eq("academic_year_id", year["id"])
        .execute()
        .data
    )
    class_by_student = {}
    for e in enr:
        sc = e.get("school_class") or {}
        if sc:
            class_by_student[e["student_id"]] = f"{sc['level']}/{sc['branch']}"

    items = [
        {
            "id": s["id"],
            "student_number": s["student_number"],
            "first_name": s["first_name"],
            "last_name": s["last_name"],
            "status": s["status"],
            "class_label": class_by_student.get(s["id"]),
        }
        for s in students
    ]

    return {
        "school_name": ctx["school_name"],
        "district": ctx["district"],
        "academic_year": year["name"],
        "classes": classes,
        "students": items,
    }


@api.post("/school/students")
async def school_students_create(request: Request):
    """Create one student + its current-year class enrollment.

    school_id and academic_year_id are resolved server-side. The chosen
    school_class_id is validated to belong to the logged-in school. If the
    enrollment insert fails, the just-created student is removed (no orphan).
    """
    _uid, acc = _require_school_ready(request)
    client = get_service_client()
    school_id = acc["school_id"]

    body = await request.json()
    student_number = str((body or {}).get("student_number", "")).strip()
    first_name = str((body or {}).get("first_name", "")).strip()
    last_name = str((body or {}).get("last_name", "")).strip()
    school_class_id = (body or {}).get("school_class_id")

    if not student_number:
        raise HTTPException(status_code=400, detail="Öğrenci numarası gerekli.")
    if not first_name:
        raise HTTPException(status_code=400, detail="Ad gerekli.")
    if not last_name:
        raise HTTPException(status_code=400, detail="Soyad gerekli.")
    if not school_class_id:
        raise HTTPException(status_code=400, detail="Sınıf seçimi gerekli.")

    year = _active_academic_year(client)
    if year is None:
        raise HTTPException(status_code=409, detail="Aktif eğitim yılı belirlenemedi. Lütfen RAM ile iletişime geçin.")

    # Chosen class must belong to THIS school (never trust the frontend).
    crows = (
        client.table("school_classes")
        .select("id,school_id")
        .eq("id", school_class_id)
        .limit(1)
        .execute()
        .data
    )
    cls = crows[0] if crows else None
    if cls is None or cls["school_id"] != school_id:
        raise HTTPException(status_code=400, detail="Seçilen sınıf bu okula ait değil.")

    # Friendly duplicate handling for UNIQUE (school_id, student_number).
    dup = (
        client.table("students")
        .select("id")
        .eq("school_id", school_id)
        .eq("student_number", student_number)
        .limit(1)
        .execute()
        .data
    )
    if dup:
        raise HTTPException(status_code=409, detail="Bu öğrenci numarası zaten kayıtlı.")

    # 1) Insert the student.
    try:
        srows = (
            client.table("students")
            .insert({
                "school_id": school_id,
                "student_number": student_number,
                "first_name": first_name,
                "last_name": last_name,
                "status": "active",
            })
            .execute()
            .data
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("student insert failed")
        msg = str(e).lower()
        if "uq_students_school_student_number" in msg or "duplicate" in msg or "unique" in msg:
            raise HTTPException(status_code=409, detail="Bu öğrenci numarası zaten kayıtlı.")
        raise HTTPException(status_code=500, detail="Öğrenci oluşturulamadı.")
    student = srows[0] if srows else None
    if not student:
        raise HTTPException(status_code=500, detail="Öğrenci oluşturulamadı.")
    student_id = student["id"]

    # 2) Insert the enrollment; on failure, roll back the student.
    try:
        client.table("student_class_enrollments").insert({
            "student_id": student_id,
            "school_id": school_id,
            "academic_year_id": year["id"],
            "school_class_id": school_class_id,
        }).execute()
    except Exception as e:  # noqa: BLE001
        logger.exception("enrollment insert failed; rolling back student")
        try:
            client.table("students").delete().eq("id", student_id).eq("school_id", school_id).execute()
        except Exception:  # noqa: BLE001
            logger.exception("student cleanup failed (orphan risk)")
        raise HTTPException(status_code=500, detail="Öğrenci sınıfa atanamadı, işlem geri alındı. Lütfen tekrar deneyin.")

    return {
        "id": student_id,
        "student_number": student_number,
        "first_name": first_name,
        "last_name": last_name,
        "status": "active",
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
