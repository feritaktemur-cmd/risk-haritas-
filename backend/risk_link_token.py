"""Risk Haritası sınıf bağlantısı token yardımcıları (saf stdlib).

- Deterministik: gizli anahtar + sınıf + eğitim yılı + o sınıfın kaçıncı bağlantısı
  olduğu (sıra no) -> aynı token. Ham token DB'de saklanmaz; yalnızca SHA-256 hash'i
  (risk_class_links.token_hash) tutulur. QR yeniden istendiğinde token yeniden üretilip
  kayıtlı hash ile karşılaştırılır.
- Gizli anahtar: RIBA_LINK_SECRET (mevcut). RİBA ve DNA'dan ayrı önek kullanılır.
- Gizli anahtar yoksa fail-closed: token üretilmez.
"""
import base64
import hashlib
import hmac
import os

_TOKEN_PREFIX = "pdrpusula:risk-link:v1"


class RiskLinkTokenError(RuntimeError):
    pass


def _secret() -> bytes:
    secret = os.environ.get("RIBA_LINK_SECRET")
    if not secret or not secret.strip():
        raise RiskLinkTokenError("Bağlantı gizli anahtarı tanımlı değil.")
    return secret.encode("utf-8")


def generate_risk_link_token(school_class_id: str, academic_year_id: str, seq: int) -> str:
    if not school_class_id or not academic_year_id or not isinstance(seq, int) or seq < 1:
        raise RiskLinkTokenError("Geçersiz token girdisi.")
    msg = f"{_TOKEN_PREFIX}:{school_class_id}:{academic_year_id}:{seq}".encode("utf-8")
    digest = hmac.new(_secret(), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def hash_risk_link_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
