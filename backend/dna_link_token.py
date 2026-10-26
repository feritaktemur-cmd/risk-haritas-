"""DNA erişim bağlantısı token yardımcıları (saf stdlib).

- Deterministik: aynı gizli anahtar + application_id + link_version -> aynı token;
  böylece okul bağlantıyı/QR'ı sonradan tekrar görebilir, ham token DB'de saklanmaz
  (yalnızca SHA-256 hash: dna_access_links.token_hash).
- Gizli anahtar: RIBA_LINK_SECRET (mevcut). RİBA token'larından ayrı bir domain
  öneki kullanıldığı için iki modülün token'ları asla çakışmaz.
- Gizli anahtar yoksa fail-closed: token üretilmez.
"""
import base64
import hashlib
import hmac
import os

_TOKEN_PREFIX = "pdrpusula:dna-link:v1"


class DnaLinkTokenError(RuntimeError):
    pass


def _secret() -> bytes:
    secret = os.environ.get("RIBA_LINK_SECRET")
    if not secret or not secret.strip():
        raise DnaLinkTokenError("Bağlantı gizli anahtarı tanımlı değil.")
    return secret.encode("utf-8")


def generate_dna_token(application_id: str, link_version: int) -> str:
    if not application_id or not isinstance(link_version, int) or link_version < 1:
        raise DnaLinkTokenError("Geçersiz token girdisi.")
    msg = f"{_TOKEN_PREFIX}:{application_id}:{link_version}".encode("utf-8")
    digest = hmac.new(_secret(), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def hash_dna_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
