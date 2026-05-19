"""
services/budget_service.py
===========================
Bütçe analizi, rapor üretimi ve sepet değerlendirme servisi.
SOLID: Single Responsibility — sadece finansal hesaplamalar.
"""
from __future__ import annotations
import logging
from datetime import datetime
from typing import Optional

import aiosqlite

from models.schemas import (
    BudceKaydet, BudceYanit, AylikRapor, YillikRapor,
    KategoriHarcama, Siparis, SiparisUrun, SiparisDurumu,
    OdemeAlternatifi,
)

logger = logging.getLogger(__name__)


class BudgetService:
    """Tüm finansal işlemleri yönetir."""

    # ── Bütçe CRUD ───────────────────────────────────────────────────────────
    async def butce_kaydet(self, db: aiosqlite.Connection, kullanici_id: int, veri: BudceKaydet) -> BudceYanit:
        await db.execute(
            """INSERT INTO butceler (kullanici_id, aylik_gelir, aylik_sabit_gider, birikim_hedefi, guncellendi)
               VALUES (?,?,?,?, datetime('now'))
               ON CONFLICT(kullanici_id) DO UPDATE SET
                 aylik_gelir=excluded.aylik_gelir,
                 aylik_sabit_gider=excluded.aylik_sabit_gider,
                 birikim_hedefi=excluded.birikim_hedefi,
                 guncellendi=datetime('now')""",
            (kullanici_id, veri.aylik_gelir, veri.aylik_sabit_gider, veri.birikim_hedefi)
        )
        await db.commit()
        return self._hesapla(veri.aylik_gelir, veri.aylik_sabit_gider, veri.birikim_hedefi)

    async def butce_getir(self, db: aiosqlite.Connection, kullanici_id: int) -> Optional[BudceYanit]:
        async with db.execute(
            "SELECT aylik_gelir, aylik_sabit_gider, birikim_hedefi FROM butceler WHERE kullanici_id=?",
            (kullanici_id,)
        ) as cur:
            row = await cur.fetchone()
        if not row:
            return None
        return self._hesapla(row["aylik_gelir"], row["aylik_sabit_gider"], row["birikim_hedefi"])

    def _hesapla(self, gelir: float, gider: float, birikim: float) -> BudceYanit:
        return BudceYanit(
            aylik_gelir=gelir,
            aylik_sabit_gider=gider,
            birikim_hedefi=birikim,
            kullanilabilir_butce=max(0.0, gelir - gider - birikim),
        )

    # ── Ödeme Alternatifleri ─────────────────────────────────────────────────
    def odeme_alternatifleri_olustur(self, toplam: float) -> list[OdemeAlternatifi]:
        alternatifler = []
        for ay, faiz in [(3, 0.0), (6, 1.5), (9, 2.5), (12, 3.5)]:
            faizli = toplam * (1 + faiz / 100 * ay)
            alternatifler.append(OdemeAlternatifi(
                plan_adi=f"{ay} Taksit" + (" (Faizsiz)" if faiz == 0 else f" (%{faiz} aylık faiz)"),
                aylik_taksit=round(faizli / ay, 2),
                toplam_tutar=round(faizli, 2),
                faiz_orani=faiz,
                ay_sayisi=ay,
            ))
        alternatifler.append(OdemeAlternatifi(
            plan_adi="BNPL — Şimdi Al, Sonra Öde (3 ay faizsiz)",
            aylik_taksit=round(toplam / 3, 2),
            toplam_tutar=toplam,
            faiz_orani=0.0,
            ay_sayisi=3,
        ))
        return alternatifler

    # ── Aylik Rapor ──────────────────────────────────────────────────────────
    async def aylik_rapor(self, db: aiosqlite.Connection, kullanici_id: int, yil: int, ay: int) -> AylikRapor:
        ay_str  = f"{yil}-{ay:02d}"
        async with db.execute(
            """SELECT s.id, s.olusturuldu, s.durum, s.toplam_tutar
               FROM siparisler s WHERE s.kullanici_id=?
               AND strftime('%Y-%m', s.olusturuldu)=?""",
            (kullanici_id, ay_str)
        ) as cur:
            siparis_rows = await cur.fetchall()

        siparisler = []
        toplam = 0.0
        kategori_map: dict[str, dict] = {}

        for row in siparis_rows:
            toplam += row["toplam_tutar"]
            async with db.execute(
                """SELECT sk.adet, sk.birim_fiyat, u.kategori
                   FROM siparis_kalemleri sk JOIN urunler u ON sk.urun_id=u.id
                   WHERE sk.siparis_id=?""",
                (row["id"],)
            ) as cur2:
                kalemler = await cur2.fetchall()

            urun_list = []
            for k in kalemler:
                kat = k["kategori"]
                if kat not in kategori_map:
                    kategori_map[kat] = {"toplam": 0.0, "adet": 0}
                kategori_map[kat]["toplam"] += k["birim_fiyat"] * k["adet"]
                kategori_map[kat]["adet"]   += k["adet"]
                urun_list.append(SiparisUrun(urun_id=0, adet=k["adet"], birim_fiyat=k["birim_fiyat"]))

            siparisler.append(Siparis(
                id=row["id"],
                tarih=datetime.fromisoformat(row["olusturuldu"]),
                durum=SiparisDurumu(row["durum"]),
                toplam_tutar=row["toplam_tutar"],
                urunler=urun_list,
            ))

        kategori_list = [KategoriHarcama(kategori=k, toplam=v["toplam"], adet=v["adet"])
                         for k, v in sorted(kategori_map.items(), key=lambda x: x[1]["toplam"], reverse=True)]
        return AylikRapor(yil=yil, ay=ay, toplam_harcama=toplam,
                          kategori_dagilimi=kategori_list, siparisler=siparisler)

    # ── Yıllık Rapor ─────────────────────────────────────────────────────────
    async def yillik_rapor(self, db: aiosqlite.Connection, kullanici_id: int, yil: int) -> YillikRapor:
        async with db.execute(
            """SELECT s.id, s.olusturuldu, s.durum, s.toplam_tutar
               FROM siparisler s WHERE s.kullanici_id=?
               AND strftime('%Y', s.olusturuldu)=?""",
            (kullanici_id, str(yil))
        ) as cur:
            siparis_rows = await cur.fetchall()

        toplam = sum(r["toplam_tutar"] for r in siparis_rows)
        kategori_map: dict[str, dict] = {}
        siparisler = []

        for row in siparis_rows:
            async with db.execute(
                """SELECT sk.adet, sk.birim_fiyat, u.kategori
                   FROM siparis_kalemleri sk JOIN urunler u ON sk.urun_id=u.id
                   WHERE sk.siparis_id=?""",
                (row["id"],)
            ) as cur2:
                kalemler = await cur2.fetchall()
            for k in kalemler:
                kat = k["kategori"]
                if kat not in kategori_map:
                    kategori_map[kat] = {"toplam": 0.0, "adet": 0}
                kategori_map[kat]["toplam"] += k["birim_fiyat"] * k["adet"]
                kategori_map[kat]["adet"]   += k["adet"]
            siparisler.append(Siparis(
                id=row["id"],
                tarih=datetime.fromisoformat(row["olusturuldu"]),
                durum=SiparisDurumu(row["durum"]),
                toplam_tutar=row["toplam_tutar"],
                urunler=[],
            ))

        kategori_list = [KategoriHarcama(kategori=k, toplam=v["toplam"], adet=v["adet"])
                         for k, v in sorted(kategori_map.items(), key=lambda x: x[1]["toplam"], reverse=True)]
        en_cok = kategori_list[0].kategori if kategori_list else "Bilinmiyor"
        return YillikRapor(yil=yil, toplam_harcama=toplam, en_cok_kategori=en_cok,
                           kategori_dagilimi=kategori_list, siparisler=siparisler)


budget_service = BudgetService()
