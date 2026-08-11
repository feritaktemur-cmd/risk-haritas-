"""Helpers for school account creation: username generation, temp password,
and the synthetic (emailless) Auth identity model.

No plaintext password is ever persisted here; passwords live only in Supabase Auth.
"""
import re
import secrets
import string

# Synthetic email domain for emailless school Auth users. This is a backend-only
# implementation detail (schools log in later with username + password, never email).
SYNTH_EMAIL_DOMAIN = "okul.pdrpusula.local"

# Turkish character simplification (both cases collapse to ASCII).
_TR_MAP = {
    "ç": "c", "Ç": "c",
    "ğ": "g", "Ğ": "g",
    "ı": "i", "I": "i", "İ": "i",
    "ö": "o", "Ö": "o",
    "ş": "s", "Ş": "s",
    "ü": "u", "Ü": "u",
}


def slugify_tr(value: str) -> str:
    """Lowercase + Turkish simplification + keep only [a-z0-9]."""
    if not value:
        return ""
    out = []
    for ch in value:
        out.append(_TR_MAP.get(ch, ch))
    s = "".join(out).lower()
    return re.sub(r"[^a-z0-9]", "", s)


def generate_username(school_name: str, district_name: str, existing_lower: set) -> str:
    """Deterministic, case-insensitive-unique username.

    base = slug(school_name). If taken -> base_slug(district). If still taken ->
    append an incrementing numeric suffix. Never mutates existing accounts.
    `existing_lower` is a set of already-used usernames in lowercase.
    """
    base = slugify_tr(school_name) or "okul"
    if base.lower() not in existing_lower:
        return base

    district_slug = slugify_tr(district_name)
    candidate = f"{base}_{district_slug}" if district_slug else base
    if candidate.lower() not in existing_lower:
        return candidate

    # Deterministic numeric disambiguation.
    n = 2
    while True:
        c = f"{candidate}_{n}"
        if c.lower() not in existing_lower:
            return c
        n += 1


def generate_temp_password(length: int = 14) -> str:
    """Strong random temp password with >=1 upper, lower, digit, special."""
    lowers = string.ascii_lowercase
    uppers = string.ascii_uppercase
    digits = string.digits
    specials = "!@#$%^&*?-_"
    # Guarantee one of each class.
    chars = [
        secrets.choice(uppers),
        secrets.choice(lowers),
        secrets.choice(digits),
        secrets.choice(specials),
    ]
    pool = lowers + uppers + digits + specials
    chars += [secrets.choice(pool) for _ in range(max(0, length - len(chars)))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def synth_email_for(username: str) -> str:
    return f"{username}@{SYNTH_EMAIL_DOMAIN}"
