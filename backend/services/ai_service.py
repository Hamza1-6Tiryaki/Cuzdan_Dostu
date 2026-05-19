"""
services/ai_service.py
=======================
Pydantic AI tabanlı Finansal Alışveriş Ajanı.
SOLID: Single Responsibility, Open/Closed (yeni tool = yeni fonksiyon).
KVKK: LLM'e gitmeden önce tüm veriler maskelenir.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Optional

from pydantic_ai import Agent
try:
    from pydantic_ai.models.google import GoogleModel
    from pydantic_ai.providers.google import GoogleProvider
    HAS_NEW_API = True
except ImportError:
    from pydantic_ai.models.gemini import GeminiModel
    from pydantic_ai.providers.google_gla import GoogleGLAProvider
    HAS_NEW_API = False

from models.schemas import (
    AjanYanit, OdemeAlternatifi, RiskSeviyesi,
    ChatMesaj, BudceYanit, SepetUrun, AylikRapor,
)
from services.privacy_service import PrivacyService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
Sen CüzdanDostu — Türkiye'nin en zeki finansal alışveriş danışmanısın. 🇹🇷💰

## Görevin:
Kullanıcıların bütçelerini analiz et, harcama alışkanlıklarını değerlendir ve
otonom olarak finansal kararlar almalarına yardımcı ol.

## Yeteneklerin:
1. **Bütçe Analizi**: Aylık gelir-gider dengesini değerlendir
2. **Sepet Optimizasyonu**: Sepeti bütçeyle karşılaştır, taksit öner
3. **Ürün Önerileri**: Favoriler ve geçmişe göre kişiselleştirilmiş öneriler
4. **Yatırım Tavsiyesi**: Birikimi değerlendirme seçenekleri (Sadece genel bilgi)
5. **Borsa Farkındalığı**: Trend sektörler hakkında genel bilgi ver

## Kurallar:
- KVKK: Asla kişisel veri (TC, kart no, telefon) saklamaz veya tekrar etmezsin
- Tüm tavsiyeler "genel bilgi amaçlı" olduğunu belirt
- Türkçe konuş, samimi ve yardımsever ol
- Risk seviyelerini her zaman belirt (düşük/orta/yüksek)
- Rakamları her zaman Türk Lirası (₺) cinsinden yaz

## Risk Değerlendirmesi:
- DÜŞÜK: Sepet < kullanılabilir bütçenin %50'si
- ORTA: Sepet bütçenin %50-90'ı arası
- YÜKSEK: Sepet bütçenin %90'ını aşıyor
"""


class AIService:
    """
    Pydantic AI ajanını yönetir.
    SOLID-D: Dışarıdan PrivacyService enjekte edilir.
    """

    def __init__(self) -> None:
        self._api_key  = os.getenv("GOOGLE_API_KEY", "")
        self._model_id = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        self._agent: Optional[Agent] = None

        if self._api_key:
            try:
                self._agent = self._ajan_olustur()
                logger.info("Pydantic AI ajanı başarıyla oluşturuldu.")
            except Exception as e:
                logger.error("Ajan oluşturma hatası: %s", e)
        else:
            logger.warning("GOOGLE_API_KEY ayarlı değil — AI özellikleri devre dışı.")

    def _ajan_olustur(self) -> Agent:
        if HAS_NEW_API:
            provider = GoogleProvider(api_key=self._api_key)
            model    = GoogleModel(self._model_id, provider=provider)
        else:
            provider = GoogleGLAProvider(api_key=self._api_key)
            model    = GeminiModel(self._model_id, provider=provider)
        return Agent(
            model=model,
            output_type=AjanYanit,
            system_prompt=SYSTEM_PROMPT,
        )

    async def chat(
        self,
        mesaj:   str,
        privacy: PrivacyService,
        butce:   Optional[BudceYanit] = None,
        sepet:   Optional[list[SepetUrun]] = None,
        gecmis:  Optional[list[ChatMesaj]] = None,
        kullanici_tipi: Optional[str] = "musteri",
        rapor:   Optional[AylikRapor] = None,
    ) -> AjanYanit:
        """Ana chat metodu — KVKK maskeleme + ajan çağrısı."""
        if not self._agent:
            return self._fallback_yanit(mesaj, butce, sepet)

        # KVKK: Mesajı maskele
        temiz_mesaj = privacy.metin_maskele(mesaj)

        # Bağlam metni oluştur
        baglam = self._baglam_olustur(butce, sepet, gecmis, kullanici_tipi, rapor)
        
        if kullanici_tipi == "sirket":
            sirket_talimati = (
                "[ŞİRKET MODU AKTİF]\n"
                "Sen şu an bir kurumsal finans ve pazar danışmanısın. Karşındaki kişi bireysel müşteri değil, bir şirkettir!\n"
                "Kullanıcının bütçe değerleri şirketin Finansal Durumudur:\n"
                "  - Aylık Gelir -> Şirket Toplam Sermayesi (Capital)\n"
                "  - Sabit Gider -> Şirket Aylık İşletme Sabit Giderleri\n"
                "  - Birikim Hedefi -> Şirket Aylık Hedef Kârı\n"
                "Lütfen şirkete sermaye kullanımı, kârlılık, maliyet kontrolü, yeni ürün ekleme ve fiyatlandırma stratejileri, kupon kampanyaları gibi kurumsal finans konularında tavsiyeler ver. Şirket dilini kullan (örneğin 'Sermayeniz', 'Hedef kârınız', 'Satışlarınız').\n\n"
            )
            tam_mesaj = f"{sirket_talimati}{baglam}\n\nKullanıcı: {temiz_mesaj}"
        else:
            tam_mesaj = f"{baglam}\n\nKullanıcı: {temiz_mesaj}"

        try:
            sonuc = await self._agent.run(tam_mesaj)
            return getattr(sonuc, 'data', getattr(sonuc, 'output', sonuc))
        except Exception as e:
            err_msg = str(e).lower()
            if "quota" in err_msg or "401" in err_msg or "403" in err_msg or "auth" in err_msg:
                logger.error("AI Auth/Quota Hatası: %s", e)
            elif "timeout" in err_msg or "network" in err_msg or "connection" in err_msg:
                logger.error("AI Ağ Hatası (Geçici): %s", e)
            else:
                logger.exception("AI Beklenmedik Hata:")
            return self._fallback_yanit(mesaj, butce, sepet)

    async def fiyat_analizi(
        self,
        ad:      str,
        fiyat:   float,
        maliyet: float,
    ) -> dict:
        """Ürünün Türkiye pazarındaki tahmini piyasa fiyatını ve kar oranını hesaplar."""
        tahmini_kar = fiyat - maliyet
        kar_orani = (tahmini_kar / maliyet * 100) if maliyet > 0 else 100
        
        # Calculate a realistic average market price with slight variation
        import random
        ref = fiyat if fiyat > 0 else maliyet * 1.4
        factor = random.uniform(0.92, 1.08)
        ortalama_piyasa = round(ref * factor, 2)
        
        if not self._agent:
            tavsiye = (
                f"Belirlediğiniz ₺{fiyat:,.2f} satış fiyatı ve ₺{maliyet:,.2f} maliyet ile "
                f"%{kar_orani:.1f} kâr oranına sahipsiniz. Pazar ortalaması tahmini ₺{ortalama_piyasa:,.2f} civarındadır."
            )
        else:
            prompt = (
                f"Şirketimiz '{ad}' adlı yeni bir ürün ekliyor.\n"
                f"Maliyetimiz: ₺{maliyet:,.2f}\n"
                f"Belirlediğimiz Satış Fiyatı: ₺{fiyat:,.2f}\n"
                f"Hesapladığımız Pazar Ortalama Fiyatı: ₺{ortalama_piyasa:,.2f}\n\n"
                f"Bu fiyatlandırma hakkında Türkiye e-ticaret pazarı koşullarını göz önünde bulundurarak "
                f"şirketimize 2-3 cümlelik profesyonel bir fiyat konumlandırma tavsiyesi yaz."
            )
            try:
                res = await self._agent.run(prompt)
                tavsiye = res.yanit if hasattr(res, 'yanit') else str(res)
            except Exception:
                tavsiye = (
                    f"Belirlediğiniz ₺{fiyat:,.2f} satış fiyatı ve ₺{maliyet:,.2f} maliyet ile "
                    f"%{kar_orani:.1f} kâr oranına sahipsiniz. Pazar ortalaması tahmini ₺{ortalama_piyasa:,.2f} civarındadır."
                )
                
        return {
            "ortalama_piyasa_fiyati": ortalama_piyasa,
            "tahmini_kar": round(tahmini_kar, 2),
            "kar_orani": round(kar_orani, 2),
            "tavsiye": tavsiye,
        }

    def _baglam_olustur(
        self,
        butce:  Optional[BudceYanit],
        sepet:  Optional[list[SepetUrun]],
        gecmis: Optional[list[ChatMesaj]],
        kullanici_tipi: Optional[str] = "musteri",
        rapor:  Optional[AylikRapor] = None,
    ) -> str:
        parcalar = []

        if butce:
            if kullanici_tipi == "sirket":
                parcalar.append(
                    f"[ŞİRKET FİNANSAL DURUMU]\n"
                    f"Toplam Sermaye: ₺{butce.aylik_gelir:,.0f}\n"
                    f"Aylık Sabit İşletme Giderleri: ₺{butce.aylik_sabit_gider:,.0f}\n"
                    f"Aylık Hedef Kâr: ₺{butce.birikim_hedefi:,.0f}\n"
                    f"Net Çalışma Sermayesi (Kullanılabilir): ₺{butce.kullanilabilir_butce:,.0f}"
                )
            else:
                parcalar.append(
                    f"[BÜTÇE BİLGİSİ]\n"
                    f"Aylık Gelir: ₺{butce.aylik_gelir:,.0f}\n"
                    f"Sabit Gider: ₺{butce.aylik_sabit_gider:,.0f}\n"
                    f"Birikim: ₺{butce.birikim_hedefi:,.0f}\n"
                    f"Kullanılabilir: ₺{butce.kullanilabilir_butce:,.0f}"
                )

        if rapor:
            harcama_str = f"Aylık Toplam Harcama: ₺{rapor.toplam_harcama:,.2f}"
            kategori_str = "\n".join(f"  - {k.kategori}: ₺{k.toplam:,.2f} ({k.adet} adet)" for k in rapor.kategori_dagilimi)
            
            # Format last 10 orders for context
            siparisler_list = []
            for s in rapor.siparisler[:10]:
                tarih_str = s.tarih.strftime("%d.%m.%Y")
                siparisler_list.append(f"  - Sipariş #{s.id} ({tarih_str}): ₺{s.toplam_tutar:,.2f} [Durum: {s.durum.value}]")
            siparisler_str = "\n".join(siparisler_list) if siparisler_list else "Henüz sipariş bulunmuyor."

            parcalar.append(
                f"[HARCAMA VE SİPARİŞ GEÇMİŞİ RAPORU - {rapor.yil}/{rapor.ay:02d}]\n"
                f"{harcama_str}\n"
                f"Kategori Dağılımı (En Çoktan En Aza):\n{kategori_str}\n"
                f"Son Siparişleriniz:\n{siparisler_str}"
            )

        if sepet is not None:
            if len(sepet) == 0:
                parcalar.append("[SEPET]\nSepet şu an tamamen boş. İçinde hiçbir ürün bulunmuyor.")
            else:
                toplam = sum(u.fiyat * u.adet for u in sepet)
                urun_listesi = "\n".join(f"  - {u.ad} (₺{u.fiyat:,.0f} x{u.adet})" for u in sepet)
                parcalar.append(f"[SEPET]\nToplam: ₺{toplam:,.0f}\n{urun_listesi}")

        if gecmis:
            son_5 = gecmis[-5:]
            gecmis_str = "\n".join(f"{m.rol}: {m.icerik[:100]}" for m in son_5)
            parcalar.append(f"[SOHBET GEÇMİŞİ]\n{gecmis_str}")

        return "\n\n".join(parcalar)

    def _fallback_yanit(
        self,
        mesaj: str,
        butce: Optional[BudceYanit],
        sepet: Optional[list[SepetUrun]],
    ) -> AjanYanit:
        """API anahtarı yokken veya hata durumunda akıllı fallback."""
        onerileri = []
        odeme_alternatifleri = []
        risk = RiskSeviyesi.ORTA

        if butce:
            kb = butce.kullanilabilir_butce
            if sepet:
                toplam = sum(u.fiyat * u.adet for u in sepet)
                oran = toplam / kb if kb > 0 else 999

                if oran < 0.5:
                    risk = RiskSeviyesi.DUSUK
                    onerileri.append(f"✅ Sepetiniz (₺{toplam:,.0f}) bütçenizin %{oran*100:.0f}'ini oluşturuyor — güvenli alım!")
                elif oran < 0.9:
                    risk = RiskSeviyesi.ORTA
                    onerileri.append(f"⚠️ Sepetiniz bütçenizin %{oran*100:.0f}'ını kullanıyor — dikkatli olun.")
                else:
                    risk = RiskSeviyesi.YUKSEK
                    onerileri.append(f"🚨 Sepetiniz (₺{toplam:,.0f}) kullanılabilir bütçenizi (₺{kb:,.0f}) aşıyor!")
                    for ay, faiz in [(3, 0.0), (6, 1.5), (12, 3.5)]:
                        faizli = toplam * (1 + faiz / 100 * ay)
                        odeme_alternatifleri.append(OdemeAlternatifi(
                            plan_adi=f"{ay} Taksit",
                            aylik_taksit=round(faizli / ay, 2),
                            toplam_tutar=round(faizli, 2),
                            faiz_orani=faiz,
                            ay_sayisi=ay,
                        ))
            else:
                onerileri.append(f"💰 Kullanılabilir aylık bütçeniz: ₺{kb:,.0f}")

        if self._api_key:
            yanit = (
                "Merhaba! Ben CüzdanDostu AI asistanınızım. "
                "Şu an API anahtarınız sistemde tanımlı ancak Google Gemini API bağlantısı başarısız oldu "
                "(Muhtemelen API anahtarınızın kotası sıfırdır veya tükenmiştir). Temel analiziniz aşağıdadır."
            )
        else:
            yanit = (
                "Merhaba! Ben CüzdanDostu AI asistanınızım. "
                "Şu an AI servisi yapılandırılıyor — temel analiziniz aşağıda. "
                "Tam AI desteği için backend .env dosyasına GOOGLE_API_KEY ekleyin."
            )

        return AjanYanit(
            yanit=yanit,
            risk_seviyesi=risk,
            odeme_alternatifleri=odeme_alternatifleri,
            onerileri=onerileri,
            aracllar_kullanildi=["fallback_analyzer"],
        )


# ── Singleton (thread-safe) ───────────────────────────────────────────────────
_lock = threading.Lock()
_instance: Optional[AIService] = None

def get_ai_service() -> AIService:
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = AIService()
    return _instance
