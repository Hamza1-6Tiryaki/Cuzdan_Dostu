"""
models/schemas.py
=================
Tüm Pydantic veri modelleri — KVKK uyumlu, tip-güvenli.
SOLID: Single Responsibility — sadece veri tanımlamaları.
"""
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import hashlib
import hmac
import os
# ─── Enums ───────────────────────────────────────────────────────────────────

class KullaniciTipi(str, Enum):
    MUSTERI = "musteri"
    SIRKET  = "sirket"
    ADMIN   = "admin"

class Cinsiyet(str, Enum):
    ERKEK  = "erkek"
    KADIN  = "kadin"
    DIGER  = "diger"

class SiparisDurumu(str, Enum):
    BEKLEMEDE    = "beklemede"
    ONAYLANDI    = "onaylandi"
    KARGODA      = "kargoda"
    TESLIM_EDILDI= "teslim_edildi"
    IPTAL        = "iptal"

class UrunKategorisi(str, Enum):
    KADIN       = "Kadın"
    ERKEK       = "Erkek"
    ANNE_COCUK  = "Anne & Çocuk"
    AYAKKABI    = "Ayakkabı & Çanta"
    EV_YASAM    = "Ev & Yaşam"
    MARKET      = "Market"
    KOZMETIK    = "Kozmetik"
    ELEKTRONIK  = "Elektronik"
    SPOR        = "Spor"
    AKSESUAR    = "Aksesuar"
    OYUNCAK     = "Oyuncak"

class RiskSeviyesi(str, Enum):
    DUSUK   = "dusuk"
    ORTA    = "orta"
    YUKSEK  = "yuksek"


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class GirisIstegi(BaseModel):
    kullanici_adi: str = Field(..., min_length=3)
    sifre:        str = Field(..., min_length=6)

class KayitIstegiBase(BaseModel):
    kvkk_onay: bool = Field(..., description="KVKK sözleşmesi kabul edilmeli")

    @field_validator("kvkk_onay")
    @classmethod
    def kvkk_zorunlu(cls, v: bool) -> bool:
        if not v:
            raise ValueError("KVKK sözleşmesi kabul edilmeden kayıt yapılamaz.")
        return v

class MusteriKayitIstegi(KayitIstegiBase):
    kullanici_adi: str = Field(..., min_length=3)
    email:        str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    sifre:        str = Field(..., min_length=6)
    ad_soyad:     str = Field(..., min_length=2)
    cinsiyet:     Optional[Cinsiyet] = None
    yas:          Optional[int]      = Field(None, ge=13, le=120)
    telefon:      Optional[str]      = None


class SirketKayitIstegi(KayitIstegiBase):
    kullanici_adi:      str = Field(..., min_length=3)
    email:             str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    sifre:             str = Field(..., min_length=6)
    kurum_adi:         str = Field(..., min_length=2)
    sirket_kategorisi: str
    aciklama:          Optional[str] = None


class TokenYanit(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    kullanici_tipi: KullaniciTipi
    kullanici_id:   int
    ad:             str


# ─── Kullanıcı Profil ─────────────────────────────────────────────────────────

class ProfilGuncelle(BaseModel):
    kullanici_adi: Optional[str] = None
    email:         Optional[str] = None
    ad_soyad:      Optional[str] = None
    yas:           Optional[int] = Field(None, ge=13, le=120)
    cinsiyet:      Optional[Cinsiyet] = None
    telefon:       Optional[str] = None
    kurum_adi:     Optional[str] = None
    sirket_kategorisi: Optional[str] = None
    aciklama:      Optional[str] = None

class SifreGuncelle(BaseModel):
    eski_sifre: str
    yeni_sifre: str = Field(..., min_length=6)


# ─── Bütçe Schemas ───────────────────────────────────────────────────────────

class BudceKaydet(BaseModel):
    aylik_gelir:       float = Field(..., gt=0)
    aylik_sabit_gider: float = Field(..., ge=0)
    birikim_hedefi:    float = Field(default=0.0, ge=0)

class BudceYanit(BaseModel):
    aylik_gelir:          float
    aylik_sabit_gider:    float
    birikim_hedefi:       float
    kullanilabilir_butce: float
    harcanan_miktar:      float = 0.0


# ─── Ürün Schemas ────────────────────────────────────────────────────────────

class Urun(BaseModel):
    id:          int
    ad:          str
    kategori:    UrunKategorisi
    fiyat:       float
    marka:       str
    site:        str
    stok_var:    bool = True
    resim_url:   Optional[str] = None
    puan:        float = 4.0

class UrunDetay(Urun):
    aciklama:   Optional[str] = None
    muadiller:  list[int] = Field(default_factory=list)


# ─── Şirket Ürün & Kupon Ekleme ───────────────────────────────────────────────

class UrunEkle(BaseModel):
    ad:          str
    kategori:    str
    fiyat:       float
    marka:       Optional[str] = ""
    site:        Optional[str] = ""
    resim_url:   Optional[str] = None
    aciklama:    Optional[str] = None

class KuponEkle(BaseModel):
    kod:           str
    indirim_yuzde: float = Field(..., gt=0, le=100)
    gecerlilik:    str  # YYYY-MM-DD

class FiyatAnalizIstek(BaseModel):
    ad:      str
    fiyat:   float
    maliyet: float

class FiyatAnalizYanit(BaseModel):
    ortalama_piyasa_fiyati: float
    tahmini_kar:           float
    kar_orani:             float
    tavsiye:               str


# ─── Sipariş Schemas ─────────────────────────────────────────────────────────

class SiparisUrun(BaseModel):
    urun_id:  int
    adet:     int = Field(..., ge=1)
    birim_fiyat: float

class Siparis(BaseModel):
    id:           int
    tarih:        datetime
    durum:        SiparisDurumu
    toplam_tutar: float
    urunler:      list[SiparisUrun]


# ─── Sepet Schemas ───────────────────────────────────────────────────────────

class SepetUrun(BaseModel):
    urun_id:     int
    ad:          str
    fiyat:       float
    adet:        int = Field(default=1, ge=1)
    kategori:    str = ""
    marka:       str = ""
    site:        str = ""
    resim_url:   Optional[str] = None

class SepetAnaliz(BaseModel):
    mesaj:   str
    butce:   Optional[BudceYanit] = None
    sepet:   list[SepetUrun] = Field(default_factory=list)


# ─── AI Chat Schemas ─────────────────────────────────────────────────────────

class ChatMesaj(BaseModel):
    rol:    str  # "kullanici" | "asistan"
    icerik: str

class ChatIstek(BaseModel):
    mesaj:  str = Field(..., min_length=1, max_length=2000)
    gecmis: list[ChatMesaj] = Field(default_factory=list)
    sepet:  Optional[list[SepetUrun]] = Field(default=None)

class OdemeAlternatifi(BaseModel):
    plan_adi:      str
    aylik_taksit:  Optional[float]  = None
    toplam_tutar:  float
    faiz_orani:    Optional[float]  = None
    ay_sayisi:     Optional[int]    = None

class AjanYanit(BaseModel):
    yanit:         str
    risk_seviyesi: RiskSeviyesi = RiskSeviyesi.ORTA
    odeme_alternatifleri: list[OdemeAlternatifi] = Field(default_factory=list)
    onerileri:     list[str]    = Field(default_factory=list)
    aracllar_kullanildi: list[str] = Field(default_factory=list)


# ─── Rapor Schemas ───────────────────────────────────────────────────────────

class KategoriHarcama(BaseModel):
    kategori:   str
    toplam:     float
    adet:       int

class AylikRapor(BaseModel):
    yil:          int
    ay:           int
    toplam_harcama: float
    kategori_dagilimi: list[KategoriHarcama]
    siparisler:   list[Siparis] = Field(default_factory=list)

class YillikRapor(BaseModel):
    yil:          int
    toplam_harcama: float
    en_cok_kategori: str
    kategori_dagilimi: list[KategoriHarcama]
    siparisler:   list[Siparis] = Field(default_factory=list)


# ─── Favori/Geçmiş Schemas ───────────────────────────────────────────────────

class FavoriEkle(BaseModel):
    tur:    str  # "urun" | "marka"
    referans_id: int
    ad:     str

class GecmisUrun(BaseModel):
    urun_id:   int
    ad:        str
    kategori:  str
    fiyat:     float
    goruntuleme_sayisi: int
    son_goruntuleme:    datetime

class KuponKullan(BaseModel):
    kod: str


# ─── KVKK Maskeleme Util ─────────────────────────────────────────────────────

def pii_hashle(deger: str) -> str:
    """Hassas veriyi HMAC-SHA256 ve salt ile hash'ler — KVKK uyumlu."""
    import sys
    pii_salt = os.getenv("PII_SALT")
    if not pii_salt:
        print("WARNING: PII_SALT environment variable is not set! Using default salt which is insecure for production.", file=sys.stderr)
        pii_salt = "default-secure-salt-for-pii"
    secret_salt = pii_salt.encode()
    return hmac.new(key=secret_salt, msg=deger.encode(), digestmod=hashlib.sha256).hexdigest()[:12]
