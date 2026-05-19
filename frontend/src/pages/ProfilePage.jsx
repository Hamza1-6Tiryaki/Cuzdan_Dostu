/**
 * pages/ProfilePage.jsx — Profil, Sermaye/Bütçe, Kâr Raporları, Ürünlerim, Kupon Oluşturma
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Wallet, BarChart2, Heart, Tag, LogOut, ChevronRight,
  TrendingUp, TrendingDown, Calendar, Package, Save, Edit2, X,
  Plus, Zap, Percent, ShoppingBag, AlertCircle, Trash2, ShoppingCart, Pencil
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { budgetApi, productApi } from '../services/api';
import { useStore } from '../store/useStore';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';

const PIE_COLORS = ['#1a9464', '#4fc3f7', '#f5c842', '#ff6b6b', '#9c66ff', '#34b07e', '#e0a800'];

const formatPhone = (val) => {
  if (!val) return '-';
  if (val.length === 12 && /^[0-9a-fA-F]+$/.test(val)) {
    return 'KVKK Korumalı (Güncellemek için Düzenleyin)';
  }
  return val;
};

const ProductImage = ({ src, alt }) => {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-dark-800 text-gray-500">
      <Package size={28} className="text-gray-600 mb-1 group-hover:scale-110 transition-transform duration-300" />
      <span className="text-[10px] text-gray-500">Görsel Belirtilmedi</span>
    </div>
  );
};

export default function ProfilePage() {
  const { token, kullanici, budget, setBudget, logout } = useStore();
  const navigate = useNavigate();
  
  const sirketMi = kullanici?.tip === 'sirket';
  
  const TABS = [
    { id: 'butce', label: sirketMi ? 'Sermaye / Kâr' : 'Bütçe', icon: Wallet },
    { id: 'profil', label: sirketMi ? 'Kurumsal' : 'Kişisel', icon: User },
    { id: 'rapor', label: sirketMi ? 'Kâr Raporu' : 'Raporlar', icon: BarChart2 },
    { id: 'favori', label: sirketMi ? 'Ürünlerim' : 'Favoriler', icon: sirketMi ? Package : Heart },
    { id: 'kupon', label: 'Kuponlar', icon: Tag },
  ];
  if (sirketMi) {
    TABS.push({ id: 'sirket_siparisler', label: 'Gelen Siparişler', icon: ShoppingCart });
  }

  const [tab, setTab] = useState('butce');
  const [profil, setProfil] = useState(null);
  const [favoriler, setFav] = useState([]);
  const [kuponlar, setKup] = useState([]);
  const [sirketUrunler, setSirketUrunler] = useState([]);
  const [sirketSiparisler, setSirketSiparisler] = useState([]);
  const [ayRapor, setAy] = useState(null);
  const [yilRapor, setYil] = useState(null);
  const [loading, setL] = useState(false);
  const [budForm, setBF] = useState({ aylik_gelir: '', aylik_sabit_gider: '', birikim_hedefi: '' });
  const [editMode, setEditMode] = useState(false);
  
  // Profil formu state (Hem Bireysel hem Kurumsal alanları destekler)
  const [profForm, setProfForm] = useState({
    kullanici_adi: '', email: '', ad_soyad: '', yas: '', cinsiyet: '', telefon: '',
    kurum_adi: '', sirket_kategorisi: '', aciklama: ''
  });

  // Şirket: Yeni ürün ekleme form state
  const [showProductModal, setShowProductModal] = useState(false);
  const [prodForm, setProdForm] = useState({
    ad: '', kategori: 'Giyim', fiyat: '', maliyet: '', resim_url: '', site: 'Trendyol', aciklama: ''
  });
  const [analizSonuc, setAnalizSonuc] = useState(null);
  const [analizLoading, setAnalizLoading] = useState(false);

  // Şirket: Yeni kupon ekleme form state
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({
    kod: '', indirim_yuzde: '', gecerlilik: ''
  });

  // Şirket: Ürün düzenleme state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUrun, setEditUrun] = useState(null);
  const [editForm, setEditForm] = useState({
    ad: '', kategori: 'Giyim', fiyat: '', maliyet: '', site: 'Trendyol', resim_url: '', aciklama: ''
  });
  
  // Şifre güncelleme state
  const [pwForm, setPwForm] = useState({ eski_sifre: '', yeni_sifre: '', yeni_sifre_tekrar: '' });
  const [pwLoading, setPwLoading] = useState(false);

  const bugun = new Date();

  const loadData = async () => {
    setL(true);
    try {
      const endpoints = [
        budgetApi.profil(),
        sirketMi ? productApi.sirketUrunleri() : productApi.favoriler(),
        budgetApi.kuponlar(),
        budgetApi.aylikRapor(bugun.getFullYear(), bugun.getMonth() + 1),
        budgetApi.yillikRapor(bugun.getFullYear()),
        budgetApi.getir(),
      ];
      if (sirketMi) {
        endpoints.push(budgetApi.sirketSiparisleri());
      }
      
      const results = await Promise.allSettled(endpoints);
      
      const p = results[0];
      const f = results[1];
      const k = results[2];
      const ay = results[3];
      const yil = results[4];
      const bObj = results[5];
      
      if (p.status === 'fulfilled') {
        setProfil(p.value);
        setProfForm({
          kullanici_adi: p.value.kullanici_adi || '',
          email: p.value.email || '',
          ad_soyad: p.value.ad_soyad || '',
          yas: p.value.yas || '',
          cinsiyet: p.value.cinsiyet || 'erkek',
          telefon: p.value.telefon || '',
          kurum_adi: p.value.kurum_adi || '',
          sirket_kategorisi: p.value.sirket_kategorisi || '',
          aciklama: p.value.aciklama || '',
        });
      }
      
      if (f.status === 'fulfilled') {
        if (sirketMi) {
          setSirketUrunler(f.value.urunler || []);
        } else {
          setFav(f.value.favoriler || []);
        }
      }
      
      if (k.status === 'fulfilled') setKup(k.value.kuponlar || []);
      if (ay.status === 'fulfilled') setAy(ay.value);
      if (yil.status === 'fulfilled') setYil(yil.value);
      
      if (bObj.status === 'fulfilled' && bObj.value) {
        setBudget(bObj.value);
        setBF({
          aylik_gelir: bObj.value.aylik_gelir || '',
          aylik_sabit_gider: bObj.value.aylik_sabit_gider || '',
          birikim_hedefi: bObj.value.birikim_hedefi || '',
        });
      } else if (budget) {
        setBF({
          aylik_gelir: budget.aylik_gelir || '',
          aylik_sabit_gider: budget.aylik_sabit_gider || '',
          birikim_hedefi: budget.birikim_hedefi || '',
        });
      }
      
      if (sirketMi && results[6]?.status === 'fulfilled') {
        setSirketSiparisler(results[6].value.siparisler || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setL(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate('/giris'); return; }
    if (kullanici?.tip === 'admin') {
      navigate('/admin');
      return;
    }
    loadData();
  }, [token, sirketMi]);

  const handleBudceSave = async () => {
    try {
      const r = await budgetApi.kaydet({
        aylik_gelir: Number(budForm.aylik_gelir),
        aylik_sabit_gider: Number(budForm.aylik_sabit_gider),
        birikim_hedefi: Number(budForm.birikim_hedefi) || 0,
      });
      setBudget(r);
      toast.success(sirketMi ? 'Sermaye ve kâr hedefleri güncellendi! 💰' : 'Bütçe kaydedildi! ✅');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Hata oluştu.');
    }
  };

  const handleProfilSave = async () => {
    try {
      const payload = {
        kullanici_adi: profForm.kullanici_adi,
        email: profForm.email,
        ad_soyad: profForm.ad_soyad,
        yas: Number(profForm.yas) || null,
        cinsiyet: profForm.cinsiyet,
        telefon: profForm.telefon,
      };

      if (sirketMi) {
        payload.kurum_adi = profForm.kurum_adi;
        payload.sirket_kategorisi = profForm.sirket_kategorisi;
        payload.aciklama = profForm.aciklama;
      }

      const r = await budgetApi.profilGuncelle(payload);
      setProfil(r);
      setEditMode(false);
      toast.success('Profil başarıyla güncellendi! 🔒');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Profil güncellenirken hata oluştu.');
    }
  };

  const handlePasswordChange = async () => {
    if (!pwForm.eski_sifre || !pwForm.yeni_sifre) {
      toast.error('Lütfen eski ve yeni şifrenizi girin.');
      return;
    }
    if (pwForm.yeni_sifre !== pwForm.yeni_sifre_tekrar) {
      toast.error('Yeni şifreler eşleşmiyor.');
      return;
    }
    setPwLoading(true);
    try {
      await budgetApi.sifreGuncelle({
        eski_sifre: pwForm.eski_sifre,
        yeni_sifre: pwForm.yeni_sifre,
      });
      toast.success('Şifreniz başarıyla değiştirildi! 🔑');
      setPwForm({ eski_sifre: '', yeni_sifre: '', yeni_sifre_tekrar: '' });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Şifre güncellenirken hata oluştu.');
    } finally {
      setPwLoading(false);
    }
  };

  // Şirket: Ürün Fiyat Analizi yap
  const handleFiyatAnaliz = async () => {
    if (!prodForm.ad || !prodForm.fiyat || !prodForm.maliyet) {
      toast.error('Lütfen ad, fiyat ve maliyet alanlarını doldurun.');
      return;
    }
    setAnalizLoading(true);
    try {
      const r = await productApi.fiyatAnaliz({
        ad: prodForm.ad,
        fiyat: Number(prodForm.fiyat),
        maliyet: Number(prodForm.maliyet),
      });
      setAnalizSonuc(r);
      toast.success('AI Fiyat Konumlandırma Analizi Tamamlandı! 🧠💡');
    } catch (e) {
      toast.error('AI Analizi sırasında hata oluştu.');
    } finally {
      setAnalizLoading(false);
    }
  };

  // Şirket: Yeni Ürün Ekle
  const handleUrunEkle = async () => {
    try {
      await productApi.sirketUrunEkle({
        ad: prodForm.ad,
        kategori: prodForm.kategori,
        fiyat: Number(prodForm.fiyat),
        marka: profil?.kurum_adi || 'Kendi Markam',
        site: prodForm.site,
        resim_url: prodForm.resim_url || null,
        aciklama: prodForm.aciklama,
      });
      toast.success('Ürününüz başarıyla pazar yerlerinde listelendi! 🚀');
      setShowProductModal(false);
      setProdForm({ ad: '', kategori: 'Giyim', fiyat: '', maliyet: '', resim_url: '', site: 'Trendyol', aciklama: '' });
      setAnalizSonuc(null);
      // Yenile
      const f = await productApi.sirketUrunleri();
      setSirketUrunler(f.urunler || []);
    } catch (e) {
      toast.error('Ürün eklenirken bir hata oluştu.');
    }
  };

  // Şirket: Ürün Sil
  const handleUrunSil = async (id) => {
    if (!window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    try {
      await productApi.sirketUrunSil(id);
      toast.success('Ürün başarıyla silindi! 🗑️');
      // Yenile
      const f = await productApi.sirketUrunleri();
      setSirketUrunler(f.urunler || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ürün silinirken bir hata oluştu.');
    }
  };

  // Şirket: Ürün Düzenle — modal aç
  const handleUrunDuzenleAc = (urun, e) => {
    e.stopPropagation();
    setEditUrun(urun);
    setEditForm({
      ad: urun.ad || '',
      kategori: urun.kategori || 'Giyim',
      fiyat: urun.fiyat || '',
      maliyet: '',
      site: urun.site || 'Trendyol',
      resim_url: urun.resim_url || '',
      aciklama: urun.aciklama || '',
    });
    setShowEditModal(true);
  };

  // Şirket: Ürün Güncelle — kaydet
  const handleUrunGuncelle = async () => {
    if (!editForm.ad || !editForm.fiyat) {
      toast.error('Ürün adı ve fiyat zorunludur.');
      return;
    }
    try {
      await productApi.sirketUrunGuncelle(editUrun.id, {
        ad: editForm.ad,
        kategori: editForm.kategori,
        fiyat: Number(editForm.fiyat),
        marka: profil?.kurum_adi || 'Kendi Markam',
        site: editForm.site,
        resim_url: editForm.resim_url || null,
        aciklama: editForm.aciklama,
      });
      toast.success('Ürün başarıyla güncellendi! ✅');
      setShowEditModal(false);
      setEditUrun(null);
      const f = await productApi.sirketUrunleri();
      setSirketUrunler(f.urunler || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ürün güncellenirken hata oluştu.');
    }
  };

  // Şirket: Yeni Kupon Oluştur
  const handleKuponOlustur = async () => {
    if (!couponForm.kod || !couponForm.indirim_yuzde || !couponForm.gecerlilik) {
      toast.error('Lütfen tüm kupon alanlarını doldurun.');
      return;
    }
    try {
      await budgetApi.kuponEkle({
        kod: couponForm.kod.toUpperCase(),
        indirim_yuzde: Number(couponForm.indirim_yuzde),
        gecerlilik: couponForm.gecerlilik,
      });
      toast.success('İndirim kuponu müşteriler için aktif edildi! 🏷️🎉');
      setShowCouponModal(false);
      setCouponForm({ kod: '', indirim_yuzde: '', gecerlilik: '' });
      // Yenile
      const k = await budgetApi.kuponlar();
      setKup(k.kuponlar || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Kupon oluşturulamadı.');
    }
  };

  if (!token) return null;

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand text-2xl font-bold text-white uppercase">
            {sirketMi ? (profil?.kurum_adi?.[0] || 'K') : (kullanici?.ad?.[0] || '?')}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-gradient-brand">
              {sirketMi ? (profil?.kurum_adi || 'Kurumsal Üye') : kullanici?.ad}
            </h1>
            <p className="text-gray-400 text-sm capitalize">
              {sirketMi ? `Şirket Hesabı · ${profil?.sirket_kategorisi || 'Kategori Yok'}` : 'Müşteri Hesabı'}
            </p>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/giris'); toast.success('Çıkış yapıldı.'); }}
          className="btn-danger flex items-center gap-2">
          <LogOut size={16} /> Çıkış
        </button>
      </div>

      {/* ── TABS NAVIGATION ────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 p-1 glass rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0
              ${tab === id ? 'bg-brand-gradient text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

          {/* ── TAB 1: BÜTÇE / SERMAYE & KÂR ─────────────────────────────────── */}
          {tab === 'butce' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Sol Form: Değerleri Tanımlama */}
              <div className="glass-strong p-6 rounded-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Wallet size={20} className="text-brand-400" /> 
                  {sirketMi ? 'Sermaye ve Hedef Kâr Ayarları' : 'Bütçe Ayarları'}
                </h2>
                
                {[
                  { 
                    k: 'aylik_gelir', 
                    label: sirketMi ? 'Toplam Sermaye (Capital - ₺)' : 'Aylık Gelir (₺)', 
                    icon: TrendingUp,
                    desc: sirketMi ? 'Şirketinizin toplam aktif nakit ve ticari sermayesi.' : 'Aylık düzenli net geliriniz.'
                  },
                  { 
                    k: 'aylik_sabit_gider', 
                    label: sirketMi ? 'Aylık Sabit İşletme Giderleri (₺)' : 'Aylık Sabit Gider (₺)', 
                    icon: TrendingDown,
                    desc: sirketMi ? 'Kira, personel maliyeti, vergiler, lisanslar vb. toplam sabit borçlar.' : 'Kira, faturalar, abonelikler vb.'
                  },
                  { 
                    k: 'birikim_hedefi', 
                    label: sirketMi ? 'Aylık Hedef Net Kâr (₺)' : 'Aylık Birikim Hedefi (₺)', 
                    icon: Wallet,
                    desc: sirketMi ? 'Bu ay sonunda işletmenizin elde etmek istediği net kâr miktarı.' : 'Aylık tasarruf etmek istediğiniz miktar.'
                  },
                ].map(({ k, label, icon: Icon, desc }) => (
                  <div key={k} className="space-y-1">
                    <label className="input-label flex items-center gap-1"><Icon size={13} />{label}</label>
                    <input className="input-field" type="number" min="0" placeholder="0"
                      value={budForm[k]} onChange={e => setBF(f => ({ ...f, [k]: e.target.value }))} />
                    <p className="text-[10px] text-gray-500">{desc}</p>
                  </div>
                ))}
                
                <button onClick={handleBudceSave} className="btn-primary w-full flex items-center justify-center gap-2 pt-2">
                  <Save size={16} /> Değişiklikleri Kaydet
                </button>
              </div>

              {/* Sağ Görsel: Rapor / Grafik */}
              {budget && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: sirketMi ? 'Toplam Sermaye' : 'Gelir', v: budget.aylik_gelir, c: 'text-brand-400' },
                      { l: sirketMi ? 'Sabit Giderler' : 'Gider', v: budget.aylik_sabit_gider, c: 'text-red-400' },
                      { l: sirketMi ? 'Aylık Hedef Kâr' : 'Birikim Hedefi', v: budget.birikim_hedefi, c: 'text-yellow-400' },
                      { l: sirketMi ? 'Bu Ay Harcanan' : 'Harcanan', v: budget.harcanan_miktar || 0, c: 'text-orange-400' },
                    ].map(({ l, v, c }) => (
                      <div key={l} className="stat-card">
                        <div className={`stat-value text-xl ${c}`}>₺{v?.toLocaleString('tr-TR')}</div>
                        <div className="stat-label text-xs">{l}</div>
                      </div>
                    ))}
                    
                    {/* Kullanılabilir / Borç kartı */}
                    {(() => {
                      const isNegative = budget.kullanilabilir_butce < 0;
                      const absVal = Math.abs(budget.kullanilabilir_butce);
                      const displayVal = isNegative ? `-₺${absVal.toLocaleString('tr-TR')}` : `₺${absVal.toLocaleString('tr-TR')}`;
                      const displayLabel = isNegative 
                        ? (sirketMi ? 'Net Sermaye Açığı (Bu kadar borcunuz var)' : 'Bütçe Aşımı (Bu kadar borcunuz var)')
                        : (sirketMi ? 'Net Çalışma Sermayesi (Bu kadar paranız var)' : 'Kullanılabilir (Bu kadar paranız var)');
                      
                      return (
                        <div className={`stat-card col-span-2 border transition-all duration-300 ${
                          isNegative 
                            ? 'border-red-500/20 bg-red-500/5 shadow-lg shadow-red-500/5' 
                            : 'border-accent-sky/20 bg-accent-sky/5 shadow-lg shadow-accent-sky/5'
                        }`}>
                          <div className={`stat-value text-xl ${isNegative ? 'text-red-400' : 'text-accent-sky'}`}>
                            {displayVal}
                          </div>
                          <div className="stat-label text-xs">{displayLabel}</div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Sermaye / Gelir Dağılım Grafiği */}
                  <div className="glass p-4 rounded-2xl">
                    <p className="text-sm font-semibold text-gray-300 mb-3">
                      {sirketMi ? 'Finansal Kaynak Dağılımı' : 'Gelir Dağılımı'}
                    </p>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={[
                          { name: sirketMi ? 'Sabit Gider' : 'Gider', value: budget.aylik_sabit_gider, color: '#ff6b6b' },
                          { name: sirketMi ? 'Hedef Kâr' : 'Birikim Hedefi', value: budget.birikim_hedefi, color: '#f5c842' },
                          { name: sirketMi ? 'Harcanan' : 'Harcanan', value: budget.harcanan_miktar || 0, color: '#ff9800' },
                          { name: sirketMi ? 'Net Sermaye' : 'Serbest', value: budget.kullanilabilir_butce, color: '#1a9464' },
                        ].filter(item => item.value > 0)} cx="50%" cy="50%" outerRadius={70} dataKey="value" 
                          label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}
                          labelLine={false}>
                          {[
                            { name: sirketMi ? 'Sabit Gider' : 'Gider', value: budget.aylik_sabit_gider, color: '#ff6b6b' },
                            { name: sirketMi ? 'Hedef Kâr' : 'Birikim Hedefi', value: budget.birikim_hedefi, color: '#f5c842' },
                            { name: sirketMi ? 'Harcanan' : 'Harcanan', value: budget.harcanan_miktar || 0, color: '#ff9800' },
                            { name: sirketMi ? 'Net Sermaye' : 'Serbest', value: budget.kullanilabilir_butce, color: '#1a9464' },
                          ].filter(item => item.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={v => `₺${v?.toLocaleString('tr-TR')}`} 
                          contentStyle={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: KİŞİSEL / KURUMSAL PROFİL ────────────────────────────── */}
          {tab === 'profil' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              
              {/* Sol Sütun: Profil Bilgileri / Güncelleme */}
              <div className="glass-strong p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <User size={20} className="text-brand-400" /> 
                    {sirketMi ? 'Kurumsal Firma Bilgileri' : 'Kişisel Bilgiler'}
                  </h2>
                  {!editMode ? (
                    <button onClick={() => setEditMode(true)} className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-3 border border-white/10 rounded-xl hover:border-brand-400 hover:text-brand-400 transition-colors">
                      <Edit2 size={13} /> Düzenle
                    </button>
                  ) : (
                    <button onClick={() => { setEditMode(false); loadData(); }} className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-3 border border-white/10 rounded-xl hover:border-red-400 hover:text-red-400 transition-colors">
                      <X size={13} /> İptal
                    </button>
                  )}
                </div>

                {profil && (
                  <>
                    {!editMode ? (
                      /* Detay Modu */
                      <div className="space-y-4 text-sm pt-2">
                        {sirketMi ? (
                          /* Şirket Detay Listesi */
                          <>
                            {[
                              ['Kurum Adı', profil.kurum_adi || 'Firma Adı Belirtilmemiş'],
                              ['Sektör / Kategori', profil.sirket_kategorisi || 'Sektör Belirtilmemiş'],
                              ['Şirket Açıklaması', profil.aciklama || 'Açıklama girilmemiş'],
                              ['Yetkili Ad Soyad', profil.ad_soyad || '-'],
                              ['E-posta', profil.email],
                              ['Kullanıcı Adı', profil.kullanici_adi],
                              ['Telefon No', formatPhone(profil.telefon)],
                              ['Hesap Statüsü', 'Şirket Hesabı 💼'],
                            ].map(([l, v]) => (
                              <div key={l} className="flex items-start justify-between py-2 border-b border-white/6">
                                <span className="text-gray-400 w-1/3">{l}</span>
                                <span className="text-gray-100 font-medium capitalize text-right flex-1">{v}</span>
                              </div>
                            ))}
                          </>
                        ) : (
                          /* Müşteri Detay Listesi */
                          <>
                            {[
                              ['Kullanıcı Adı', profil.kullanici_adi],
                              ['Email', profil.email],
                              ['Ad Soyad', profil.ad_soyad || '-'],
                              ['Yaş', profil.yas || '-'],
                              ['Cinsiyet', profil.cinsiyet || '-'],
                              ['Telefon', formatPhone(profil.telefon)],
                              ['Hesap Tipi', 'Bireysel Müşteri 👤'],
                            ].map(([l, v]) => (
                              <div key={l} className="flex items-center justify-between py-2 border-b border-white/6">
                                <span className="text-gray-400">{l}</span>
                                <span className="text-gray-100 font-medium capitalize">{v}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ) : (
                      /* Düzenleme Modu */
                      <div className="space-y-4 pt-2">
                        {sirketMi ? (
                          /* Şirket Düzenleme Input'ları */
                          <>
                            <div>
                              <label className="input-label">Kurum Adı (Resmi Ünvan)</label>
                              <input className="input-field" type="text" placeholder="Firma adını girin"
                                value={profForm.kurum_adi} onChange={e => setProfForm(f => ({ ...f, kurum_adi: e.target.value }))} />
                            </div>
                            <div>
                              <label className="input-label">Şirket Sektörü / Kategorisi</label>
                              <input className="input-field" type="text" placeholder="Teknoloji, Gıda, Perakende vb."
                                value={profForm.sirket_kategorisi} onChange={e => setProfForm(f => ({ ...f, sirket_kategorisi: e.target.value }))} />
                            </div>
                            <div>
                              <label className="input-label">Şirket Açıklaması</label>
                              <textarea className="input-field min-h-[80px]" placeholder="Firmanız hakkında kısa bir tanıtım yazın"
                                value={profForm.aciklama} onChange={e => setProfForm(f => ({ ...f, aciklama: e.target.value }))} />
                            </div>
                            <div>
                              <label className="input-label">Yetkili Adı Soyadı</label>
                              <input className="input-field" type="text" placeholder="İletişim kurulacak yetkili kişi"
                                value={profForm.ad_soyad} onChange={e => setProfForm(f => ({ ...f, ad_soyad: e.target.value }))} />
                            </div>
                          </>
                        ) : (
                          /* Müşteri Düzenleme Input'ları */
                          <>
                            <div>
                              <label className="input-label">Ad Soyad</label>
                              <input className="input-field" type="text" placeholder="Ad Soyad girin"
                                value={profForm.ad_soyad} onChange={e => setProfForm(f => ({ ...f, ad_soyad: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="input-label">Yaş</label>
                                <input className="input-field" type="number" min="13" max="120" placeholder="Yaş girin"
                                  value={profForm.yas} onChange={e => setProfForm(f => ({ ...f, yas: e.target.value }))} />
                              </div>
                              <div>
                                <label className="input-label">Cinsiyet</label>
                                <select className="input-field bg-dark-900 border border-white/10 text-gray-100"
                                  value={profForm.cinsiyet} onChange={e => setProfForm(f => ({ ...f, cinsiyet: e.target.value }))}>
                                  <option value="erkek">Erkek</option>
                                  <option value="kadin">Kadın</option>
                                  <option value="diger">Diğer</option>
                                </select>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {/* Ortak Alanlar */}
                        <div>
                          <label className="input-label">Giriş E-postası</label>
                          <input className="input-field" type="email" placeholder="E-posta girin"
                            value={profForm.email} onChange={e => setProfForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="input-label">Kullanıcı Adı</label>
                            <input className="input-field" type="text" placeholder="Kullanıcı adı"
                              value={profForm.kullanici_adi} onChange={e => setProfForm(f => ({ ...f, kullanici_adi: e.target.value }))} />
                          </div>
                          <div>
                            <label className="input-label">Telefon Numarası</label>
                            <input className="input-field" type="text" placeholder="Telefon girin"
                              value={profForm.telefon} onChange={e => setProfForm(f => ({ ...f, telefon: e.target.value }))} />
                          </div>
                        </div>

                        <button onClick={handleProfilSave} className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
                          <Save size={16} /> Kaydet
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sağ Sütun: Kurumsal Hızlı Menü (Favoriler/Ürünlerim ve Kuponlar Kısayolları) */}
              <div className="glass-strong p-6 rounded-2xl space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Package size={20} className="text-brand-400" /> Hızlı Menü
                </h2>
                <p className="text-sm text-gray-400">
                  {sirketMi ? 'Ürünlerinizi yönetebilir ve yeni indirim kuponları oluşturabilirsiniz.' : 'Favorilerinize ve kuponlarınıza buradan hızlıca erişebilirsiniz.'}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Ürünlerim / Favorilerim Kartı */}
                  <div onClick={() => setTab('favori')}
                    className="glass p-5 rounded-2xl border border-white/8 hover:border-brand-500/30 hover:bg-white/5 transition-all cursor-pointer group flex flex-col justify-between min-h-[140px] relative overflow-hidden">
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-brand-500/10 rounded-xl group-hover:bg-brand-500/20 transition-colors">
                        {sirketMi ? <Package size={24} className="text-brand-400" /> : <Heart size={24} className="text-red-400" />}
                      </div>
                      <span className={`text-xs ${sirketMi ? 'badge-green' : 'badge-red'}`}>
                        {sirketMi ? `${sirketUrunler.length} Ürün` : `${favoriler.length} Ürün`}
                      </span>
                    </div>
                    <div className="mt-4">
                      <h4 className={`font-bold text-gray-100 group-hover:text-brand-400 transition-colors`}>
                        {sirketMi ? 'Ürün Yönetimi' : 'Favorilerim'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {sirketMi ? 'Satıştaki ürünleriniz, maliyet ve stok durumu.' : 'Beğendiğiniz ve takip ettiğiniz ürünler.'}
                      </p>
                    </div>
                  </div>

                  {/* Kupon Kartı */}
                  <div onClick={() => setTab('kupon')}
                    className="glass p-5 rounded-2xl border border-white/8 hover:border-yellow-500/30 hover:bg-white/5 transition-all cursor-pointer group flex flex-col justify-between min-h-[140px] relative overflow-hidden">
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:bg-yellow-500/20 transition-colors">
                        <Tag size={24} className="text-yellow-400" />
                      </div>
                      <span className="badge-yellow text-xs">{kuponlar.length} Kupon</span>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-bold text-gray-100 group-hover:text-yellow-400 transition-colors">Kupon Kampanyaları</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {sirketMi ? 'Müşterileriniz için özel indirim kodları tanımlayın.' : 'Aktif indirim kuponlarınız ve kodlarınız.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Şifre Değiştirme Kartı */}
                <div className="glass-strong p-6 rounded-2xl space-y-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Zap size={20} className="text-brand-400" /> Şifreyi Güncelle
                  </h2>
                  <p className="text-sm text-gray-400">
                    Hesap şifrenizi güvenli bir şekilde güncelleyebilirsiniz.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="input-label">Eski Şifre</label>
                      <input className="input-field" type="password" placeholder="Mevcut şifreniz"
                        value={pwForm.eski_sifre} onChange={e => setPwForm(f => ({ ...f, eski_sifre: e.target.value }))} />
                    </div>
                    <div>
                      <label className="input-label">Yeni Şifre</label>
                      <input className="input-field" type="password" placeholder="Yeni şifreniz"
                        value={pwForm.yeni_sifre} onChange={e => setPwForm(f => ({ ...f, yeni_sifre: e.target.value }))} />
                    </div>
                    <div>
                      <label className="input-label">Yeni Şifre (Tekrar)</label>
                      <input className="input-field" type="password" placeholder="Yeni şifreniz tekrar"
                        value={pwForm.yeni_sifre_tekrar} onChange={e => setPwForm(f => ({ ...f, yeni_sifre_tekrar: e.target.value }))} />
                    </div>
                    <button onClick={handlePasswordChange} disabled={pwLoading} className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
                      {pwLoading ? 'Güncelleniyor...' : <Save size={16} />} Şifreyi Kaydet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: RAPORLAR / DİNAMİK KÂR RAPORU ────────────────────────── */}
          {tab === 'rapor' && (
            <div className="space-y-6">
              {sirketMi ? (
                /* ŞİRKET BAZLI DİNAMİK KÂR RAPORU */
                <div className="space-y-6">
                  <div className="glass-strong p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Calendar size={18} className="text-accent-sky" /> 
                      {bugun.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} Finansal Performans Raporu
                    </h3>
                    
                    {budget ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                          
                          {/* Dinamik Hesaplamalar */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="stat-card">
                              <div className="stat-value text-gradient-gold">₺{budget.aylik_gelir?.toLocaleString('tr-TR')}</div>
                              <div className="stat-label text-xs">Aylık Kazanılan Ciro</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value text-red-400">₺{budget.aylik_sabit_gider?.toLocaleString('tr-TR')}</div>
                              <div className="stat-label text-xs">İşletme Sabit Maliyetleri</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value text-brand-400">₺{(budget.aylik_gelir - budget.aylik_sabit_gider)?.toLocaleString('tr-TR')}</div>
                              <div className="stat-label text-xs">Aylık Net Kâr Tutarı</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-value text-accent-sky">
                                %{budget.aylik_gelir > 0 ? (((budget.aylik_gelir - budget.aylik_sabit_gider) / budget.aylik_gelir) * 100).toFixed(1) : '0'}
                              </div>
                              <div className="stat-label text-xs">Net Kâr Marjı</div>
                            </div>
                          </div>

                          <div className="glass p-4 rounded-xl border border-white/6">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap size={16} className="text-yellow-400" />
                              <h4 className="font-bold text-sm text-gray-200">Kâr Hedefine Ulaşım Oranı</h4>
                            </div>
                            {budget.birikim_hedefi > 0 ? (
                              <div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                  <span>Aylık Hedef Kâr: ₺{budget.birikim_hedefi.toLocaleString('tr-TR')}</span>
                                  <span className="font-bold text-yellow-400">
                                    %{(((budget.aylik_gelir - budget.aylik_sabit_gider) / budget.birikim_hedefi) * 100).toFixed(0)}
                                  </span>
                                </div>
                                <div className="h-2.5 bg-dark-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-brand-gradient rounded-full" 
                                    style={{ width: `${Math.min((((budget.aylik_gelir - budget.aylik_sabit_gider) / budget.birikim_hedefi) * 100), 100)}%` }} />
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">Hedef kâr girilmemiş. Sermaye/Kâr sekmesinden hedef kârınızı belirleyebilirsiniz.</p>
                            )}
                          </div>
                        </div>

                        {/* Finansal Grafik Gösterimi */}
                        <div className="flex flex-col justify-center">
                          <p className="text-sm font-semibold text-gray-300 mb-3">Gelir ve Gider Dengesi</p>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={[
                              { name: 'Aylık Ciro', Tutar: budget.aylik_gelir, fill: '#1a9464' },
                              { name: 'Sabit Giderler', Tutar: budget.aylik_sabit_gider, fill: '#ef4444' },
                              { name: 'Net Kâr', Tutar: budget.aylik_gelir - budget.aylik_sabit_gider, fill: '#f5c842' },
                            ]}>
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                              <Tooltip formatter={v => `₺${v?.toLocaleString('tr-TR')}`} 
                                contentStyle={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                              <Bar dataKey="Tutar" radius={[6, 6, 0, 0]}>
                                {[0, 1, 2].map((entry, index) => {
                                  const colors = ['#1a9464', '#ef4444', '#f5c842'];
                                  return <Cell key={`cell-${index}`} fill={colors[index]} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Finansal veri bulunamadı.</p>
                    )}
                  </div>
                </div>
              ) : (
                /* BİREYSEL MÜŞTERİ BÜTÇE RAPORU */
                <div className="space-y-6">
                  {/* Aylık */}
                  <div className="glass-strong p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Calendar size={18} className="text-accent-sky" /> 
                      {bugun.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} Raporu
                    </h3>
                    {ayRapor ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="stat-card mb-4">
                            <div className="stat-value text-gradient-gold">₺{ayRapor.toplam_harcama?.toLocaleString('tr-TR')}</div>
                            <div className="stat-label">Bu Ay Toplam Harcama</div>
                          </div>
                          {ayRapor.kategori_dagilimi?.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Kategori Dağılımı</p>
                              {ayRapor.kategori_dagilimi.map(({ kategori, toplam, adet }) => (
                                <div key={kategori} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-300">{kategori}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">{adet} sipariş</span>
                                    <span className="text-brand-400 font-semibold">₺{toplam?.toLocaleString('tr-TR')}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : <p className="text-gray-500 text-sm">Bu ay henüz alışveriş yapılmadı.</p>}
                        </div>
                        {ayRapor.kategori_dagilimi?.length > 0 && (
                          <div className="flex flex-col items-center justify-center">
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 self-start">Görsel Dağılım</p>
                            <ResponsiveContainer width="100%" height={180}>
                              <PieChart>
                                <Pie
                                  data={ayRapor.kategori_dagilimi}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  paddingAngle={3}
                                  dataKey="toplam"
                                  nameKey="kategori"
                                >
                                  {ayRapor.kategori_dagilimi.map((entry, index) => {
                                    const KATEGORI_RENKLERI = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
                                    return <Cell key={`cell-${index}`} fill={KATEGORI_RENKLERI[index % KATEGORI_RENKLERI.length]} />;
                                  })}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#0d1520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} formatter={v => `₺${v?.toLocaleString('tr-TR')}`} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    ) : <p className="text-gray-500 text-sm">Bu ay rapor verisi yok.</p>}
                  </div>

                  {/* Yıllık */}
                  <div className="glass-strong p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <TrendingUp size={18} className="text-brand-400" /> {bugun.getFullYear()} Yılı Raporu
                    </h3>
                    {yilRapor ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="stat-card">
                          <div className="stat-value text-gradient-brand">₺{yilRapor.toplam_harcama?.toLocaleString('tr-TR')}</div>
                          <div className="stat-label">Yıllık Toplam Harcama</div>
                        </div>
                        <div className="stat-card md:col-span-2">
                          <div className="stat-value text-yellow-400 text-lg">{yilRapor.en_cok_kategori || 'Sipariş yok'}</div>
                          <div className="stat-label">En Çok Harcama Yapılan Kategori</div>
                        </div>
                      </div>
                    ) : <p className="text-gray-500 text-sm">Bu yıl rapor verisi yok.</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: FAVORİLER / ŞİRKETİN KENDİ ÜRÜNLERİ ─────────────────────── */}
          {tab === 'favori' && (
            <div>
              {sirketMi ? (
                /* ŞİRKET BAZINDA KENDİ ÜRÜNLERİNİ EKLEME VE YÖNETME PANELİ */
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Package size={20} className="text-brand-400" /> 
                      Satıştaki Ürünlerim
                      <span className="badge-green">{sirketUrunler.length}</span>
                    </h2>
                    <button onClick={() => setShowProductModal(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4 shadow-brand">
                      <Plus size={16} /> Yeni Ürün Ekle
                    </button>
                  </div>

                  {sirketUrunler.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {sirketUrunler.map(urun => (
                        <div key={urun.id} onClick={() => navigate(`/urun/${urun.id}`)} className="glass p-4 rounded-2xl flex flex-col justify-between h-full border border-white/8 relative overflow-hidden group cursor-pointer hover:border-brand-500/30 transition-all">
                          <div className="relative overflow-hidden h-36 bg-dark-700 rounded-xl mb-3">
                            <ProductImage src={urun.resim_url} alt={urun.ad} />
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all z-10">
                              <button
                                onClick={(e) => handleUrunDuzenleAc(urun, e)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-600/95 text-white hover:bg-brand-700 transition-all shadow-md"
                                title="Ürünü Düzenle"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUrunSil(urun.id); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-600/95 text-white hover:bg-red-700 transition-all shadow-md"
                                title="Ürünü Sil"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="flex-1">
                            <span className="text-[10px] bg-brand-500/10 text-brand-400 py-0.5 px-2 rounded-full font-bold uppercase">{urun.kategori}</span>
                            <h4 className="font-semibold text-gray-100 text-sm mt-1.5 line-clamp-1">{urun.ad}</h4>
                            <p className="text-[10px] text-gray-500">{urun.site}</p>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                            <span className="font-bold text-white text-sm">₺{urun.fiyat?.toLocaleString('tr-TR')}</span>
                            <span className="text-[10px] text-brand-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full">Stokta Var</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass p-12 rounded-2xl text-center text-gray-500">
                      <Package size={40} className="mx-auto mb-3 text-gray-600" />
                      <p className="text-gray-300 font-medium">Henüz satılık bir ürününüz bulunmuyor.</p>
                      <p className="text-xs text-gray-500 mt-1">Hemen ilk ürününüzü ekleyin, AI fiyatlama analizi ile anında ciro kâr marjınızı öğrenin!</p>
                      <button onClick={() => setShowProductModal(true)} className="btn-primary inline-flex mt-4 text-sm py-2.5 px-5">
                        <Plus size={16} /> İlk Ürünü Ekle
                      </button>
                    </div>
                  )}

                  {/* Dynamic AI Product Positioner and Add Product Modal Drawer */}
                  {showProductModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/70 backdrop-blur-md">
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="glass-strong w-full max-w-2xl rounded-3xl p-6 shadow-brand border border-white/10 overflow-y-auto max-h-[90vh] space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-white/6">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-gradient-brand">
                            <ShoppingBag size={20} className="text-brand-400" /> AI Destekli Pazar Ürün Kayıt Sistemi
                          </h3>
                          <button onClick={() => { setShowProductModal(false); setAnalizSonuc(null); }} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="input-label">Ürün Adı</label>
                            <input className="input-field" type="text" placeholder="Örn: Kablosuz Bluetooth Kulaklık"
                              value={prodForm.ad} onChange={e => setProdForm(f => ({ ...f, ad: e.target.value }))} />
                          </div>
                          <div>
                            <label className="input-label">Kategori</label>
                            <select className="input-field bg-dark-900 text-gray-100"
                              value={prodForm.kategori} onChange={e => setProdForm(f => ({ ...f, kategori: e.target.value }))}>
                              {['Giyim', 'Elektronik', 'Kozmetik', 'Ev', 'Kitap', 'Gıda', 'Spor', 'Diğer'].map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="input-label">Satış Fiyatı (₺)</label>
                            <input className="input-field" type="number" min="0" placeholder="Müşteriye satacağınız fiyat"
                              value={prodForm.fiyat} onChange={e => setProdForm(f => ({ ...f, fiyat: e.target.value }))} />
                          </div>
                          <div>
                            <label className="input-label">Ürün Maliyeti (₺)</label>
                            <input className="input-field" type="number" min="0" placeholder="Ürünün size olan maliyeti"
                              value={prodForm.maliyet} onChange={e => setProdForm(f => ({ ...f, maliyet: e.target.value }))} />
                          </div>
                          <div>
                            <label className="input-label">Platform (Yayınlama Kanalı)</label>
                            <select className="input-field bg-dark-900 text-gray-100"
                              value={prodForm.site} onChange={e => setProdForm(f => ({ ...f, site: e.target.value }))}>
                              {['Trendyol', 'Amazon', 'Hepsiburada', 'N11', 'Kendi Web Sitemiz'].map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="input-label">Ürün Görsel URL (İsteğe Bağlı)</label>
                            <input className="input-field" type="text" placeholder="Görsel linki yapıştırın"
                              value={prodForm.resim_url} onChange={e => setProdForm(f => ({ ...f, resim_url: e.target.value }))} />
                          </div>
                          <div className="md:col-span-2">
                            <label className="input-label">Ürün Açıklaması</label>
                            <textarea className="input-field min-h-[60px]" placeholder="Ürün özelliklerini ve detaylarını yazın"
                              value={prodForm.aciklama} onChange={e => setProdForm(f => ({ ...f, aciklama: e.target.value }))} />
                          </div>
                        </div>

                        {/* AI Price Positioner Recommendation display panel */}
                        <AnimatePresence>
                          {analizSonuc && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="glass-strong p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 space-y-3">
                              <div className="flex items-center gap-2">
                                <Zap size={16} className="text-yellow-400" />
                                <h4 className="font-bold text-sm text-yellow-400">AI Fiyatlandırma & Kâr Analizi Sonuçları</h4>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2.5 bg-dark-800 rounded-xl">
                                  <div className="text-xs text-gray-400">Piyasa Ortalaması</div>
                                  <div className="text-sm font-bold text-white">₺{analizSonuc.ortalama_piyasa_fiyati?.toLocaleString('tr-TR')}</div>
                                </div>
                                <div className="p-2.5 bg-dark-800 rounded-xl">
                                  <div className="text-xs text-gray-400">Tahmini Kâr</div>
                                  <div className="text-sm font-bold text-brand-400">₺{analizSonuc.tahmini_kar?.toLocaleString('tr-TR')}</div>
                                </div>
                                <div className="p-2.5 bg-dark-800 rounded-xl">
                                  <div className="text-xs text-gray-400">Kâr Marjı</div>
                                  <div className="text-sm font-bold text-accent-sky">%{analizSonuc.kar_orani?.toFixed(1)}</div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-300 leading-relaxed border-t border-white/6 pt-2">
                                <span className="font-bold text-yellow-400">AI Önerisi:</span> {analizSonuc.tavsiye}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex gap-3 pt-2">
                          <button onClick={handleFiyatAnaliz} disabled={analizLoading}
                            className="btn-gold flex-1 flex items-center justify-center gap-2">
                            {analizLoading ? (
                              <div className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                            ) : (
                              <><Zap size={16} /> Fiyatı Analiz Et</>
                            )}
                          </button>
                          
                          <button onClick={handleUrunEkle} disabled={!analizSonuc}
                            className={`flex-1 flex items-center justify-center gap-2 ${analizSonuc ? 'btn-primary' : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5 py-2.5 px-4 rounded-xl'}`}>
                            <Save size={16} /> Ürünü Kaydet & Yayınla
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Ürün Düzenleme Modalı */}
                  {showEditModal && editUrun && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/70 backdrop-blur-md">
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="glass-strong w-full max-w-2xl rounded-3xl p-6 shadow-brand border border-white/10 overflow-y-auto max-h-[90vh] space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-white/6">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-gradient-brand">
                            <Pencil size={20} className="text-brand-400" /> Ürünü Düzenle
                          </h3>
                          <button onClick={() => { setShowEditModal(false); setEditUrun(null); }} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="input-label">Ürün Adı</label>
                            <input className="input-field" type="text" placeholder="Ürün adı"
                              value={editForm.ad} onChange={e => setEditForm(f => ({ ...f, ad: e.target.value }))} />
                          </div>
                          <div>
                            <label className="input-label">Kategori</label>
                            <select className="input-field bg-dark-900 text-gray-100"
                              value={editForm.kategori} onChange={e => setEditForm(f => ({ ...f, kategori: e.target.value }))}>
                              {['Giyim', 'Elektronik', 'Kozmetik', 'Ev', 'Kitap', 'Gıda', 'Spor', 'Diğer'].map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="input-label">Satış Fiyatı (₺)</label>
                            <input className="input-field" type="number" min="0"
                              value={editForm.fiyat} onChange={e => setEditForm(f => ({ ...f, fiyat: e.target.value }))} />
                          </div>
                          <div>
                            <label className="input-label">Platform (Yayınlama Kanalı)</label>
                            <select className="input-field bg-dark-900 text-gray-100"
                              value={editForm.site} onChange={e => setEditForm(f => ({ ...f, site: e.target.value }))}>
                              {['Trendyol', 'Amazon', 'Hepsiburada', 'N11', 'Kendi Web Sitemiz'].map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="input-label">Ürün Görsel URL (İsteğe Bağlı)</label>
                            <input className="input-field" type="text" placeholder="Görsel linki yapıştırın"
                              value={editForm.resim_url} onChange={e => setEditForm(f => ({ ...f, resim_url: e.target.value }))} />
                          </div>
                          <div className="md:col-span-2">
                            <label className="input-label">Ürün Açıklaması</label>
                            <textarea className="input-field min-h-[60px]" placeholder="Ürün özelliklerini ve detaylarını yazın"
                              value={editForm.aciklama} onChange={e => setEditForm(f => ({ ...f, aciklama: e.target.value }))} />
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button onClick={() => { setShowEditModal(false); setEditUrun(null); }}
                            className="btn-secondary flex-1 flex items-center justify-center gap-2">
                            <X size={16} /> İptal
                          </button>
                          <button onClick={handleUrunGuncelle}
                            className="btn-primary flex-1 flex items-center justify-center gap-2">
                            <Save size={16} /> Değişiklikleri Kaydet
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              ) : (
                /* MÜŞTERİ BAZINDA FAVORİ LİSTESİ */
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Heart size={20} className="text-red-400" /> Favorilerim
                    <span className="badge-red">{favoriler.length}</span>
                  </h2>
                  {favoriler.filter(f => f.fiyat).length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {favoriler.filter(f => f.fiyat).map(f => (
                        <ProductCard key={f.id} urun={{ id: f.referans_id, ad: f.ad, fiyat: f.fiyat, kategori: f.kategori, marka: f.marka, site: f.site, stok_var: f.stok_var, resim_url: f.resim_url, puan: f.puan }}
                          favoriler={favoriler} onFavoriChange={() => productApi.favoriler().then(r => setFav(r.favoriler || []))} />
                      ))}
                    </div>
                  ) : (
                    <div className="glass p-12 rounded-2xl text-center text-gray-500">
                      <Heart size={40} className="mx-auto mb-3 text-gray-600" />
                      <p>Henüz favori ürün yok.</p>
                      <Link to="/urunler" className="btn-primary inline-flex mt-4 text-sm py-2 px-4">Ürünleri Keşfet</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 5: KUPONLAR / KAMPANYALAR ──────────────────────────────── */}
          {tab === 'kupon' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Tag size={20} className="text-yellow-400" /> 
                  {sirketMi ? 'Firma İndirim Kuponlarım' : 'İndirim Kuponlarım'}
                </h2>
                {sirketMi && (
                  <button onClick={() => setShowCouponModal(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4 shadow-brand">
                    <Plus size={16} /> Yeni Kupon Tanımla
                  </button>
                )}
              </div>

              {kuponlar.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kuponlar.map(k => (
                    <div key={k.id} className="glass p-5 rounded-2xl border border-yellow-500/20 flex flex-col justify-between min-h-[120px] relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-3 z-10">
                        <span className="font-mono font-bold text-lg text-yellow-400">{k.kod}</span>
                        <span className="badge-yellow">%{k.indirim_yuzde} İndirim</span>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-2 border-t border-white/5 z-10">
                        <span className="text-xs text-gray-500">Son Geçerlilik: {new Date(k.gecerlilik).toLocaleDateString('tr-TR')}</span>
                        {sirketMi && (
                          <span className={`text-[10px] ${k.kullanildi === 1 ? 'text-red-400 bg-red-400/10' : 'text-brand-400 bg-green-500/10'} px-2 py-0.5 rounded-full font-bold`}>
                            {k.kullanildi === 1 ? 'Tükendi' : 'Aktif'}
                          </span>
                        )}
                      </div>
                      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-yellow-500/5 rounded-full filter blur-xl group-hover:bg-yellow-500/10 transition-colors z-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass p-12 rounded-2xl text-center text-gray-500">
                  <Tag size={40} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-300 font-medium">Herhangi bir aktif indirim kuponu bulunamadı.</p>
                  {sirketMi && (
                    <button onClick={() => setShowCouponModal(true)} className="btn-primary inline-flex mt-4 text-sm py-2.5 px-5">
                      <Plus size={16} /> İlk İndirim Kuponunu Oluştur
                    </button>
                  )}
                </div>
              )}

              {/* Add Coupon Modal overlay popup */}
              {showCouponModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/70 backdrop-blur-md">
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="glass-strong w-full max-w-md rounded-3xl p-6 shadow-brand border border-white/10 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-white/6">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-gradient-brand">
                        <Tag size={20} className="text-brand-400" /> Müşteri İndirim Kampanyası Oluştur
                      </h3>
                      <button onClick={() => setShowCouponModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="input-label">Kupon Kodu (Sadece Büyük Harf & Rakam)</label>
                        <input className="input-field font-mono uppercase" type="text" placeholder="Örn: YAZINDİRİM20"
                          value={couponForm.kod} onChange={e => setCouponForm(f => ({ ...f, kod: e.target.value.replace(/[^a-zA-Z0-9]/g, '') }))} />
                      </div>
                      <div>
                        <label className="input-label">İndirim Oranı (%)</label>
                        <input className="input-field" type="number" min="1" max="100" placeholder="İndirim oranını girin (1-100)"
                          value={couponForm.indirim_yuzde} onChange={e => setCouponForm(f => ({ ...f, indirim_yuzde: e.target.value }))} />
                      </div>
                      <div>
                        <label className="input-label">Son Kullanım Tarihi (Son Geçerlilik)</label>
                        <input className="input-field text-gray-100" type="date"
                          value={couponForm.gecerlilik} onChange={e => setCouponForm(f => ({ ...f, gecerlilik: e.target.value }))} />
                      </div>
                    </div>

                    <button onClick={handleKuponOlustur} className="btn-primary w-full flex items-center justify-center gap-2 mt-4 pt-2">
                      <Save size={16} /> Kampanyayı Başlat & Yayınla
                    </button>
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 6: GELEN SİPARİŞLER (ŞİRKET ÖZEL) ────────────────────────── */}
          {tab === 'sirket_siparisler' && sirketMi && (
            <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <ShoppingCart size={18} className="text-brand-400" /> Ürünlerinize Gelen Siparişler
              </h3>

              {sirketSiparisler.length > 0 ? (
                <div className="space-y-4">
                  {sirketSiparisler.map((item, idx) => {
                    let statusBadge = 'badge-yellow';
                    if (item.durum === 'teslim_edildi' || item.durum === 'onaylandi') statusBadge = 'badge-green';
                    if (item.durum === 'iptal') statusBadge = 'badge-red';
                    
                    return (
                      <div key={idx} className="glass p-5 rounded-2xl border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-brand-500/20 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-dark-700 border border-white/5">
                            <ProductImage src={item.urun_resim_url} alt={item.urun_ad} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">Sipariş #{item.siparis_id}</span>
                              <span className="text-xs text-gray-500">· {item.urun_marka}</span>
                            </div>
                            <h4 className="font-semibold text-gray-200 text-sm mt-0.5 line-clamp-1">{item.urun_ad}</h4>
                            <p className="text-[11px] text-gray-400 mt-1">
                              Alıcı: <strong className="text-white">{item.musteri_adi}</strong> ({item.musteri_email})
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Tarih: {new Date(item.olusturuldu).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end justify-between self-stretch sm:self-auto gap-2">
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Adet: <strong className="text-white">{item.adet}</strong></p>
                            <p className="text-sm font-bold text-brand-400 mt-0.5">₺{(item.birim_fiyat * item.adet).toLocaleString('tr-TR')}</p>
                          </div>
                          <span className={`${statusBadge} uppercase text-[9px] font-bold self-start sm:self-auto`}>
                            {item.durum}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass p-12 rounded-2xl text-center text-gray-500">
                  <ShoppingCart size={40} className="mx-auto mb-3 text-gray-600" />
                  <p>Henüz gelen bir sipariş bulunmuyor.</p>
                </div>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
