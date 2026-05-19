/**
 * pages/ProductDetailPage.jsx — Ürün Detay ve AI Finansal Tanıtım Sayfası
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Star, ShoppingCart, Package, ExternalLink,
  ShieldCheck, TrendingUp, Wallet, Percent, AlertTriangle, Info
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { productApi } from '../services/api';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, kullanici, budget, addToCart } = useStore();

  const [urun, setUrun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const loadUrun = async () => {
      setLoading(true);
      try {
        const data = await productApi.detay(id);
        setUrun(data);
        // Görüntüleme kaydı
        if (token) {
          productApi.goruntule(id).catch(() => {});
        }
      } catch (err) {
        toast.error('Ürün yüklenirken bir hata oluştu.');
        navigate('/urunler');
      } finally {
        setLoading(false);
      }
    };
    loadUrun();
  }, [id, token, navigate]);

  useEffect(() => {
    if (urun && kullanici && urun.bildirim_listesi) {
      const ids = urun.bildirim_listesi.split(',').map(x => x.trim());
      if (ids.includes(String(kullanici.id))) {
        setSubscribed(true);
      }
    }
  }, [urun, kullanici]);

  const handleSepeteEkle = () => {
    if (!token || !kullanici) {
      toast.error('Sepete ürün eklemek için önce giriş yapmalısınız.');
      navigate('/giris');
      return;
    }
    if (!urun) return;
    addToCart({
      urun_id: urun.id,
      ad: urun.ad,
      fiyat: urun.fiyat,
      kategori: urun.kategori,
      marka: urun.marka,
      site: urun.site,
      resim_url: urun.resim_url,
    });
    toast.success(`${urun.ad} sepete eklendi! 🛒`);
  };

  const handleStokHaberVer = async () => {
    if (!token || !kullanici) {
      toast.error('Stok bildirim listesine kaydolmak için önce giriş yapmalısınız.');
      navigate('/giris');
      return;
    }
    try {
      const res = await productApi.stokBildir(urun.id);
      setSubscribed(true);
      toast.success(res.mesaj || 'Stok bildirim listesine kaydedildiniz. 🔔');
    } catch (err) {
      toast.error('Bildirim kaydedilemedi.');
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="skeleton h-10 w-24" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="skeleton h-[450px] w-full" />
          <div className="space-y-4">
            <div className="skeleton h-6 w-1/3" />
            <div className="skeleton h-10 w-3/4" />
            <div className="skeleton h-8 w-1/4" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-12 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!urun) return null;

  const sirketMi = kullanici?.tip === 'sirket';

  // ── FİNANSAL ZEKÂ & BÜTÇE UYUM HESAPLAMALARI ───────────────────────────────
  const kullanilabilir = budget?.kullanilabilir_butce || 0;
  const sepetFiyat = urun.fiyat || 0;
  
  // Risk Seviyesi Belirleme
  let riskSeviyesi = 'ORTA';
  let riskAciklamasi = 'Bütçe verileri tanımlanmadığı için genel risk analizi yapılıyor.';
  let riskBadge = 'badge-yellow';
  let riskOrani = 0;

  if (kullanilabilir > 0) {
    riskOrani = (sepetFiyat / kullanilabilir) * 100;
    if (riskOrani < 25) {
      riskSeviyesi = 'DÜŞÜK';
      riskBadge = 'badge-green';
      riskAciklamasi = 'Bu harcama bütçeniz için oldukça güvenlidir. Aylık serbest bütçenizi sarsmaz.';
    } else if (riskOrani < 65) {
      riskSeviyesi = 'ORTA';
      riskBadge = 'badge-yellow';
      riskAciklamasi = 'Harcama bütçenizi orta derecede etkiliyor. Bu ayki diğer lüks harcamalarınızı kısmayı düşünebilirsiniz.';
    } else {
      riskSeviyesi = 'YÜKSEK';
      riskBadge = 'badge-red';
      riskAciklamasi = '🚨 Bu harcama aylık limitlerinizi zorluyor! Taksit seçeneklerini kullanmanızı veya bir sonraki aya ertelemenizi tavsiye ederiz.';
    }
  }

  // Taksit Alternatifleri
  const taksitler = [
    { ay: 3, faiz: 0.0, etiket: 'Faizsiz Taksit' },
    { ay: 6, faiz: 1.5, etiket: 'Düşük Vade Farklı' },
    { ay: 12, faiz: 3.5, etiket: 'Uzun Vade Taksit' },
  ].map(({ ay, faiz, etiket }) => {
    const toplam = sepetFiyat * (1 + (faiz / 100) * ay);
    return {
      ay,
      taksit: toplam / ay,
      toplam,
      faiz,
      etiket
    };
  });

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8">
      {/* Geri Dön Butonu */}
      <button
        onClick={() => navigate(-1)}
        className="btn-secondary flex items-center gap-2 mb-8 py-2 px-4 text-sm"
      >
        <ChevronLeft size={16} /> Geri Dön
      </button>

      {/* Ana Detay Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SOL: Görsel & Görsel Galerisi */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="relative overflow-hidden aspect-square w-full bg-dark-700 rounded-3xl border border-white/8 group shadow-lg">
            {imgErr || !urun.resim_url ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-dark-800 text-gray-500">
                <Package size={80} className="text-gray-600 mb-3 group-hover:scale-105 transition-transform duration-300" />
                <span className="text-sm font-medium text-gray-400">Ürün Görseli Bulunmuyor</span>
              </div>
            ) : (
              <img
                src={urun.resim_url}
                alt={urun.ad}
                onError={() => setImgErr(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
            
            {/* Marka/Site Badge */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-dark-900/80 text-xs text-gray-300 backdrop-blur-md border border-white/5">
              {urun.site || 'Trendyol'}
            </div>
          </div>
        </div>

        {/* SAĞ: Ürün Künyesi & Fiyat */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            
            {/* Üst Bilgiler */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs bg-brand-500/10 text-brand-400 py-1 px-3 rounded-full font-bold uppercase tracking-wider border border-brand-500/20">
                {urun.kategori}
              </span>
              <span className={`text-xs ${urun.stok_var ? 'badge-green' : 'badge-red'}`}>
                {urun.stok_var ? 'Stokta Var' : 'Tükendi'}
              </span>
              <div className="flex items-center gap-1.5 text-yellow-400 text-sm ml-2">
                <Star size={14} fill="currentColor" />
                <span className="font-semibold">{urun.puan?.toFixed(1) || '4.0'} / 5.0</span>
              </div>
            </div>

            {/* Ürün Adı & Marka */}
            <div>
              <p className="text-sm text-brand-400 font-bold tracking-wider uppercase">{urun.marka || 'Markasız'}</p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mt-1 leading-tight">
                {urun.ad}
              </h1>
            </div>

            {/* Fiyat Bilgisi */}
            <div className="glass p-5 rounded-2xl border border-white/6 inline-flex flex-col gap-1 min-w-[200px]">
              <span className="text-xs text-gray-400 font-medium">Satış Fiyatı</span>
              <span className="text-3xl font-extrabold text-gradient-brand">
                ₺{urun.fiyat?.toLocaleString('tr-TR')}
              </span>
            </div>

            {/* Ürün Açıklaması */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-300">Ürün Açıklaması</h3>
              <p className="text-sm text-gray-400 leading-relaxed max-w-2xl bg-white/3 p-4 rounded-xl border border-white/5">
                {urun.aciklama || 'Bu ürün hakkında detaylı açıklama girilmemiş.'}
              </p>
            </div>
          </div>

          {/* Sepete Ekle / Stok Haber Ver Butonu */}
          {!sirketMi && (
            <div className="pt-4 border-t border-white/5">
              {urun.stok_var ? (
                <button
                  onClick={handleSepeteEkle}
                  className="btn-primary w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 shadow-brand"
                >
                  <ShoppingCart size={18} /> Sepete Ekle
                </button>
              ) : (
                <button
                  onClick={handleStokHaberVer}
                  disabled={subscribed}
                  className={`w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 ${
                    subscribed 
                      ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 cursor-default' 
                      : 'bg-yellow-500 hover:bg-yellow-600 text-dark-950 shadow-lg shadow-yellow-500/10'
                  }`}
                >
                  <Info size={18} /> {subscribed ? 'Bildirim Listesindesiniz 🔔' : 'Stok Gelince Haber Ver'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CÜZDANDOSTU AI FİNANSAL DEĞERLENDİRME & AKILLI TAVSİYELER ────────── */}
      <div className="mt-12">
        <h2 className="text-xl md:text-2xl font-bold font-display text-gradient-brand mb-6 flex items-center gap-2.5">
          <ShieldCheck size={26} className="text-brand-400" /> CüzdanDostu AI Finansal Sağlık Raporu
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 1. Bütçe Etkisi & Risk Kartı */}
          <div className="glass-strong p-6 rounded-3xl space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-md font-bold text-gray-200 flex items-center gap-2">
                <Wallet size={18} className="text-brand-400" /> Bütçe & Risk Durumu
              </h3>
              
              {budget ? (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Kullanılabilir Aylık Bütçe</span>
                    <span className="text-white font-bold">₺{kullanilabilir.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Bu Ürünün Bütçeye Oranı</span>
                    <span className="text-brand-400 font-extrabold">%{riskOrani.toFixed(1)}</span>
                  </div>
                  
                  {/* Bütçe Oran Çubuğu */}
                  <div className="h-2 bg-dark-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${riskSeviyesi === 'DÜŞÜK' ? 'bg-emerald-500' : riskSeviyesi === 'ORTA' ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(riskOrani, 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                  <Info size={16} /> Bütçe tanımlanmadığı için finansal hesaplama yapılamadı. Profil sayfasından bütçe belirleyebilirsiniz.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Finansal Risk Seviyesi</span>
                <span className={`${riskBadge} capitalize font-bold`}>{riskSeviyesi} RİSK</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {riskAciklamasi}
              </p>
            </div>
          </div>

          {/* 2. Akıllı Taksit Önerileri */}
          <div className="glass-strong p-6 rounded-3xl space-y-4">
            <h3 className="text-md font-bold text-gray-200 flex items-center gap-2">
              <Percent size={18} className="text-yellow-400" /> CüzdanDostu Akıllı Taksit Önerileri
            </h3>
            
            <div className="space-y-3">
              {taksitler.map(({ ay, taksit, toplam, faiz, etiket }) => (
                <div
                  key={ay}
                  className="glass p-3 rounded-xl border border-white/5 flex items-center justify-between hover:border-yellow-500/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-gray-100">{ay} Taksit</span>
                      <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 py-0.5 px-1.5 rounded-full font-bold uppercase">{etiket}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      Toplam Ödeme: ₺{toplam.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} {faiz > 0 && `(%${faiz} Vade)`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-yellow-400">₺{taksit.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                    <span className="text-[9px] text-gray-500 block">/ ay</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. AI Asistan Özet Yorumu */}
          <div className="glass-strong p-6 rounded-3xl space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-md font-bold text-gray-200 flex items-center gap-2">
                <TrendingUp size={18} className="text-accent-sky" /> AI Finansal Karar Desteği
              </h3>
              
              <div className="mt-3 p-4 rounded-2xl bg-dark-900 border border-white/5 space-y-3 relative overflow-hidden">
                <div className="text-xs text-gray-300 leading-relaxed font-sans z-10 relative">
                  <span className="font-bold text-brand-400 block mb-1">🤖 CüzdanDostu Ajan Analizi:</span>
                  {riskSeviyesi === 'DÜŞÜK' ? (
                    "Bu ürünü satın almak, mevcut bütçe planınız dahilinde son derece güvenli görünüyor. Yatırım veya birikim hedefinizi aksatmadan bu harcamayı rahatça yapabilirsiniz. Hemen nakit veya faizsiz 3 taksit seçeneğiyle almanızı öneririm!"
                  ) : riskSeviyesi === 'ORTA' ? (
                    "Bu harcama bütçenizi orta vadede meşgul edebilir. Eğer bu ürüne gerçekten ihtiyacınız varsa, 6 taksit seçeneğini değerlendirerek aylık nakit akışınızı koruyabilir ve diğer harcamalarınızda tasarrufa gidebilirsiniz."
                  ) : (
                    "DİKKAT! Bu ürünün peşin maliyeti aylık birikim hedeflerinizi aşmaktadır veya bütçenizin kritik bir kısmını kaplamaktadır. Bu harcamayı mutlaka 12 taksit planına bölerek almalı veya acil bir ihtiyaç değilse önümüzdeki aya ertelemelisiniz."
                  )}
                </div>
                <div className="absolute right-[-20px] bottom-[-20px] text-brand-500/5 z-0 select-none">
                  <ShieldCheck size={120} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => navigate('/chat', { 
                  state: { 
                    urunSohbetPrompt: `${urun.ad} (₺${urun.fiyat?.toLocaleString('tr-TR')}) ürünü bütçem için nasıl bir tercih olur? Almalı mıyım? Detaylı analiz eder misin?` 
                  } 
                })}
                className="btn-secondary w-full text-xs py-2 px-3 flex items-center justify-center gap-1.5 border border-white/8 hover:border-brand-500/30"
              >
                Asistanla Sohbet Et
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
