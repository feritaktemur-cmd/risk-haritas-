"""RİBA erişim linki token yardımcıları (küçük, izole, saf-stdlib).

Tasarım:
- Token deterministiktir: aynı RIBA_LINK_SECRET + application_id + participant_type
  her zaman aynı URL-safe token'ı üretir. Böylece rehber öğretmen aynı linki/QR'ı
  sonradan tekrar görüntüleyebilir; ham token DB'de saklanmaz.
- Token, tahmin edilebilir application UUID'sini çıplak biçimde İÇERMEZ; UUID yalnız
  HMAC girdisinin bir parçasıdır.
- token_hash (SHA-256) ayrı bir helper ile üretilir; ileride
  riba_access_links.token_hash ile karşılaştırılacaktır.
- RIBA_LINK_SECRET yoksa/boşsa fail-closed: token üretilmez, açık hata verilir.
  Rastgele/geçici fallback secret ÜRETİLMEZ. Secret loglanmaz/dönülmez.
"""
import base64
import hashlib
import hmac
import os

# Domain separation: sürüm + amaç sabiti. Girdi kalıbı:
# pdrpusula:riba-link:v1:{application_id}:{participant_type}
_TOKEN_PREFIX = "pdrpusula:riba-link:v1"
_VALID_PARTICIPANT_TYPES = ("student", "parent", "teacher")


class RibaLinkTokenError(RuntimeError):
    """RİBA link token üretimi/doğrulaması için yapılandırma/girdi hatası."""


def _get_secret() -> bytes:
    """RIBA_LINK_SECRET'i okur. Yoksa/boşsa fail-closed (açık hata).

    Secret değeri asla loglanmaz veya döndürülmez.
    """
    secret = os.environ.get("RIBA_LINK_SECRET")
    if not secret or not secret.strip():
        raise RibaLinkTokenError(
            "RIBA_LINK_SECRET tanımlı değil veya boş. RİBA link token'ı üretilemez."
        )
    return secret.encode("utf-8")


def _canonical_message(application_id: str, participant_type: str) -> str:
    """HMAC girdisini domain separation ile oluşturur ve girdileri doğrular."""
    if participant_type not in _VALID_PARTICIPANT_TYPES:
        raise RibaLinkTokenError(
            f"Geçersiz participant_type: {participant_type!r}. "
            f"Yalnız {_VALID_PARTICIPANT_TYPES} kabul edilir."
        )
    if not application_id or not str(application_id).strip():
        raise RibaLinkTokenError("application_id boş olamaz.")
    return f"{_TOKEN_PREFIX}:{application_id}:{participant_type}"


def generate_link_token(application_id: str, participant_type: str) -> str:
    """Deterministik, URL-safe RİBA link token'ı üretir.

    Aynı secret + application_id + participant_type -> aynı token.
    Farklı application veya participant_type -> farklı token.
    """
    secret = _get_secret()
    message = _canonical_message(application_id, participant_type)
    digest = hmac.new(secret, message.encode("utf-8"), hashlib.sha256).digest()
    # URL-safe base64, padding'siz (URL'de temiz görünür).
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def hash_link_token(token: str) -> str:
    """Token'ın SHA-256 hex hash'ini döner.

    Bu değer riba_access_links.token_hash ile saklanacak/karşılaştırılacaktır.
    """
    if not token or not str(token).strip():
        raise RibaLinkTokenError("token boş olamaz.")
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
