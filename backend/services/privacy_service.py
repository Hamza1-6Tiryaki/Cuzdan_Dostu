"""
services/privacy_service.py
============================
KVKK uyumlu PII maskeleme katmanı.
SOLID: Single Responsibility, Open/Closed (yeni pattern eklenebilir).
"""
from __future__ import annotations
import re
import hashlib
import hmac
import os
from abc import ABC, abstractmethod

PATTERNS: dict[str, str] = {
    "tc_kimlik":  r"\b[1-9][0-9]{10}\b",
    "kart_no":    r"\b(?:\d{4}[- ]?){3}\d{4}\b",
    "iban":       r"\bTR\d{2}[0-9A-Z]{22}\b",
    "telefon":    r"\b(?:\+90|0090|90)?[\s\-]?(?:\()?[5][0-9]{2}(?:\))?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}\b",
    "email":      r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
    "adres":      r"\b\w+\s+(Sokak|Caddesi|Bulvarı|Mahallesi|Mah\.|Sok\.|Cad\.)\s+\d+\b",
}

class BasePIIEngine(ABC):
    @abstractmethod
    def maskele(self, metin: str) -> str: ...

class RegexPIIEngine(BasePIIEngine):
    def __init__(self, patterns: dict[str, str] | None = None) -> None:
        self._compiled = {k: re.compile(p) for k, p in (patterns or PATTERNS).items()}

    def maskele(self, metin: str) -> str:
        for alan, pattern in self._compiled.items():
            metin = pattern.sub(f"[{alan.upper()}_GİZLİ]", metin)
        return metin

def get_pii_salt() -> bytes:
    pii_salt = os.getenv("PII_SALT")
    if not pii_salt:
        import pathlib
        import secrets
        import sys
        salt_file = pathlib.Path(__file__).parent.parent / "data" / "pii_salt.txt"
        try:
            salt_file.parent.mkdir(parents=True, exist_ok=True)
            if salt_file.exists():
                pii_salt = salt_file.read_text().strip()
            else:
                pii_salt = secrets.token_urlsafe(32)
                salt_file.write_text(pii_salt)
                print(f"INFO: Generated persistent fallback PII_SALT at {salt_file}", file=sys.stderr)
        except Exception as e:
            print(f"WARNING: Failed to write persistent PII_SALT: {str(e)}. Using insecure default.", file=sys.stderr)
            pii_salt = "default-secure-salt-for-pii"
    return pii_salt.encode()


class PrivacyService:
    """SOLID-D: Somut motora değil soyutlamaya bağımlı."""
    def __init__(self, engine: BasePIIEngine) -> None:
        self._engine = engine

    def metin_maskele(self, metin: str) -> str:
        return self._engine.maskele(metin)

    def dict_maskele(self, veri: dict, hassas_alanlar: list[str] | None = None) -> dict:
        hassas = hassas_alanlar or ["telefon", "tc_no", "kart_no", "iban", "email"]
        temiz: dict = {}
        for k, v in veri.items():
            if k in hassas and isinstance(v, str):
                secret_salt = get_pii_salt()
                temiz[k] = hmac.new(key=secret_salt, msg=v.encode(), digestmod=hashlib.sha256).hexdigest()[:8] + "****"
            elif isinstance(v, str):
                temiz[k] = self._engine.maskele(v)
            else:
                temiz[k] = v
        return temiz


def privacy_service_olustur() -> PrivacyService:
    return PrivacyService(RegexPIIEngine())
