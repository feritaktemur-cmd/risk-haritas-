"""Supabase client singletons for the FastAPI backend.

Backend-first architecture: sensitive operations use the SERVICE (secret) client,
which bypasses Row Level Security. Never expose the secret key to the frontend.
"""
import os
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY")


@lru_cache(maxsize=1)
def get_service_client() -> Client:
    """Admin client (secret key). Bypasses RLS. Use for sensitive/aggregation ops."""
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in backend/.env")
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    """Public client (publishable key). Respects RLS."""
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in backend/.env")
    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
