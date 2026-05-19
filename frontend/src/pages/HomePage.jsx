/**
 * pages/HomePage.jsx — Anasayfa
 * Siparişler, favoriler, geçmiş, AI önerileri
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Heart, Clock, Sparkles, Package, ArrowRight, TrendingUp, Wallet } from 'lucide-react';
import { budgetApi, productApi } from '../services/api';
import { useStore } from '../store/useStore';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';

const DURUM_RENK = {
  beklemede: 'badge-yellow', onaylandi: 'badge-blue',
  kargoda: 'badge-blue', teslim_edildi: 'badge-green', iptal: 'badge-red',
};
const DURUM_TR = {
  beklemede:'Beklemede', onaylandi:'Onaylandı', kargoda:'Kargoda',
  teslim_edildi:'Teslim Edildi', iptal:'İptal',
};

function ProductImage({ src, alt }) {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return (
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover rounded-lg"
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-dark-800 text-gray-500 rounded-lg">
      <Package size={24} className="text-gray-600 mb-1" />
      <span className="text-[10px] text-gray-500">Görsel Yok</span>
    </div>
  );
}

function SiparisDurumKarti({ siparis }) {
  return (
    <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} className="glass p-4 rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">Sipariş #{siparis.id}</span>
        <span className={DURUM_RENK[siparis.durum] || 'badge-blue'}>{DURUM_TR[siparis.durum]}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">{new Date(siparis.olusturuldu).toLocaleDateString('tr-TR')}</span>
        <span className="font-bold text-gradient-brand">₺{siparis.toplam_tutar?.toLocaleString('tr-TR')}</span>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { token, kullanici, budget, setBudget } = useStore();
  const sirketMi = kullanici?.tip === 'sirket';

  const [siparisler, setSiparisler] = useState([]);
  const [favoriler,  setFavoriler]  = useState([]);
  const [gecmis,     setGecmis]     = useState([]);
  const [oneriler,   setOneriler]   = useState([]);
  const [sirketUrunler, setSirketUrunler] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const load = async () => {
      try {
        if (sirketMi) {
          const [b, u] = await Promise.allSettled([
            budgetApi.getir(), productApi.sirketUrunleri()
          ]);
          if (b.status === 'fulfilled' && b.value) setBudget(b.value);
          if (u.status === 'fulfilled' && u.value) setSirketUrunler(u.value.urunler || []);
        } else {
          const [b, s, f, g, o] = await Promise.allSettled([
            budgetApi.getir(), budgetApi.siparisler(),
            productApi.favoriler(), productApi.gecmis(), budgetApi.oneriler(),
          ]);
          if (b.status === 'fulfilled' && b.value) setBudget(b.value);
          if (s.status === 'fulfilled') setSiparisler(s.value.siparisler || []);
          if (f.status === 'fulfilled') setFavoriler(f.value.favoriler || []);
          if (g.status === 'fulfilled') setGecmis(g.value.gecmis || []);
          if (o.status === 'fulfilled') setOneriler(o.value.oneriler || []);
        }
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [token, sirketMi]);

  if (!token) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-500/8 blur-3xl animate-float"/>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-accent-sky/6 blur-3xl animate-float" style={{animationDelay:'3s'}}/>
        </div>
        <motion.div initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} className="relative z-10 max-w-lg">
          <div className="w-24 h-24 rounded-3xl bg-brand-gradient shadow-glow mx-auto mb-8 flex items-center justify-center">
            <Wallet size={48} className="text-white"/>
          </div>
          <h1 className="text-5xl font-bold font-display text-gradient-brand mb-4">CüzdanDostu</h1>
          <p className="text-gray-400 text-lg mb-8">AI destekli finansal alışveriş asistanınız. Bütçenize göre akıllı alışveriş yapın.</p>
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[['🤖','Pydantic AI'],['🔒','KVKK Uyumlu'],['📊','Akıllı Analiz']].map(([e,l])=>(
              <div key={l} className="glass p-4 rounded-xl text-center">
                <div className="text-2xl mb-2">{e}</div>
                <div className="text-xs text-gray-400">{l}</div>
              </div>
            ))}
          </div>
          <Link to="/giris" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
            Başla <ArrowRight size={20}/>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (loading) return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8 space-y-6">
      {[...Array(3)].map((_,i) => <div key={i} className="skeleton h-32 w-full"/>)}
    </div>
  );

  if (sirketMi) {
    return (
      <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8 space-y-10">
        {/* Hoş geldin & Kurumsal Başlık */}
        <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}}>
          <span className="text-xs bg-brand-500/10 text-brand-400 py-1 px-3 rounded-full font-bold uppercase tracking-wider border border-brand-500/20">
            Kurumsal Satıcı Paneli
          </span>
          <h1 className="text-3xl font-bold font-display mt-2">
            Hoş geldiniz, <span className="text-gradient-brand">{kullanici?.ad}</span> 💼
          </h1>
          <p className="text-gray-400 mt-1">
            Şirketinizin genel finansal durumunu ve satıştaki ürünlerini buradan yönetebilirsiniz.
          </p>
        </motion.div>

        {/* Kurumsal Finans Göstergeleri */}
        {budget && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.1}}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {label:'İşletme Sermayesi',val:budget.aylik_gelir,color:'text-brand-400'},
                {label:'Aylık Sabit Maliyetler',val:budget.aylik_sabit_gider,color:'text-red-400'},
                {label:'Hedef Kâr Marjı',val:budget.birikim_hedefi,color:'text-yellow-400'},
                {label:'Bu Ay Harcanan',val:budget.harcanan_miktar || 0,color:'text-orange-400'},
                {
                  label: budget.kullanilabilir_butce < 0 ? 'Net Sermaye Açığı (Borç)' : 'Kullanılabilir Likidite',
                  val: budget.kullanilabilir_butce,
                  color: budget.kullanilabilir_butce < 0 ? 'text-red-400' : 'text-accent-sky',
                  isKullanilabilir: true
                },
              ].map(({label,val,color,isKullanilabilir})=>(
                <div key={label} className="stat-card">
                  <div className={`stat-value ${color}`}>
                    {isKullanilabilir && val < 0 
                      ? `-₺${Math.abs(val)?.toLocaleString('tr-TR')}` 
                      : `₺${val?.toLocaleString('tr-TR')}`}
                  </div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Şirketin Kendi Ürünleri */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package size={20} className="text-brand-400"/> 
              Satıştaki Ürünlerim
              <span className="badge-green">{sirketUrunler.length}</span>
            </h2>
            <Link to="/profil?tab=favoriler" className="btn-secondary text-xs py-2 px-4 shadow-sm flex items-center gap-1">
              Ürün Yönetimi <ArrowRight size={14}/>
            </Link>
          </div>

          {sirketUrunler.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sirketUrunler.map(u => (
                <ProductCard key={u.id} urun={u} favoriler={[]} onFavoriChange={() => {}} />
              ))}
            </div>
          ) : (
            <div className="glass p-12 rounded-3xl text-center text-gray-500 border border-white/5">
              <Package size={48} className="mx-auto mb-3 text-gray-600"/>
              <p className="text-sm">Henüz satışta bir ürününüz bulunmuyor.</p>
              <Link to="/profil?tab=favoriler" className="btn-primary inline-flex mt-4 text-xs py-2.5 px-5">
                Yeni Ürün Ekle
              </Link>
            </div>
          )}
        </section>

        {/* Kurumsal AI Danışmanı Özet Önerisi */}
        <section className="glass p-6 rounded-3xl border border-brand-500/10 bg-brand-500/5 relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <h3 className="text-md font-bold text-gray-100 flex items-center gap-2">
              <Sparkles size={18} className="text-yellow-400"/> CüzdanDostu Kurumsal Finans Tavsiyesi
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed max-w-4xl">
              Mevcut işletme sermayeniz ve aylık sabit maliyetleriniz analiz edildiğinde, likidite oranınız dengeli seviyededir. Yeni ürün listelemeleri yaparak ve kâr marjınızı koruyarak operasyonel verimliliğinizi artırabilirsiniz. Gelecek dönem nakit akışını planlamak için AI Asistan sayfamızdan finansal borçlanma risk analizi raporu talep edebilirsiniz.
            </p>
            <div className="pt-2">
              <Link to="/chat" className="btn-primary inline-flex text-xs py-2 px-4">
                AI Asistanla Görüş
              </Link>
            </div>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] text-brand-500/5 z-0 select-none">
            <TrendingUp size={160} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8 space-y-10">
      {/* Hoş geldin */}
      <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}}>
        <h1 className="text-3xl font-bold font-display">
          Hoş geldin, <span className="text-gradient-brand">{kullanici?.ad}</span> 👋
        </h1>
        {budget && (
          <p className="text-gray-400 mt-1">
            {budget.kullanilabilir_butce < 0 ? (
              <>
                Bütçe aşımın (Borcun): <span className="text-red-400 font-semibold">-₺{Math.abs(budget.kullanilabilir_butce)?.toLocaleString('tr-TR')}</span>
              </>
            ) : (
              <>
                Kullanılabilir bütçen: <span className="text-brand-400 font-semibold">₺{budget.kullanilabilir_butce?.toLocaleString('tr-TR')}</span>
              </>
            )}
          </p>
        )}
      </motion.div>

      {/* Bütçe hızlı özet */}
      {budget && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.1}}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              {label:'Aylık Gelir',val:budget.aylik_gelir,color:'text-brand-400'},
              {label:'Sabit Gider',val:budget.aylik_sabit_gider,color:'text-red-400'},
              {label:'Birikim',val:budget.birikim_hedefi,color:'text-yellow-400'},
              {label:'Bu Ay Harcanan',val:budget.harcanan_miktar || 0,color:'text-orange-400'},
              {
                label: budget.kullanilabilir_butce < 0 ? 'Bütçe Aşımı (Borç)' : 'Kullanılabilir',
                val: budget.kullanilabilir_butce,
                color: budget.kullanilabilir_butce < 0 ? 'text-red-400' : 'text-accent-sky',
                isKullanilabilir: true
              },
            ].map(({label,val,color,isKullanilabilir})=>(
              <div key={label} className="stat-card">
                <div className={`stat-value ${color}`}>
                  {isKullanilabilir && val < 0 
                    ? `-₺${Math.abs(val)?.toLocaleString('tr-TR')}` 
                    : `₺${val?.toLocaleString('tr-TR')}`}
                </div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Siparişler */}
      {siparisler.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package size={20} className="text-brand-400"/> Siparişlerim
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {siparisler.slice(0,6).map(s => <SiparisDurumKarti key={s.id} siparis={s}/>)}
          </div>
        </section>
      )}

      {/* Favoriler */}
      {favoriler.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Heart size={20} className="text-red-400"/> Favorilerim
            </h2>
            <Link to="/profil?tab=favoriler" className="btn-ghost text-sm flex items-center gap-1">
              Tümünü gör <ArrowRight size={14}/>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {favoriler.slice(0,10).filter(f=>f.fiyat).map(f => (
              <ProductCard key={f.id} urun={{id:f.referans_id,ad:f.ad,fiyat:f.fiyat,
                kategori:f.kategori,marka:f.marka,site:f.site,
                stok_var:f.stok_var,resim_url:f.resim_url,puan:f.puan}}
                favoriler={favoriler} onFavoriChange={()=>productApi.favoriler().then(r=>setFavoriler(r.favoriler||[]))}/>
            ))}
          </div>
        </section>
      )}

      {/* Son görüntülenen */}
      {gecmis.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-accent-sky"/>
            <h2 className="text-xl font-bold">Son Görüntülenenler</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {gecmis.slice(0,8).map(u => (
              <div key={u.id} className="glass flex-shrink-0 w-44 p-3 rounded-xl">
                <div className="w-full h-28 mb-2 overflow-hidden rounded-lg">
                  <ProductImage src={u.resim_url} alt={u.ad} />
                </div>
                <p className="text-xs font-medium text-gray-200 line-clamp-2">{u.ad}</p>
                <p className="text-xs text-brand-400 font-bold mt-1">₺{u.fiyat?.toLocaleString('tr-TR')}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{u.goruntuleme_sayisi}x görüntülendi</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Öneriler */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-yellow-400"/> AI Önerileri
          </h2>
          <Link to="/chat" className="btn-ghost text-sm flex items-center gap-1 text-brand-400">
            AI ile konuş <ArrowRight size={14}/>
          </Link>
        </div>
        {oneriler.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {oneriler.map(u => (
              <ProductCard key={u.id} urun={u} favoriler={favoriler}
                onFavoriChange={()=>productApi.favoriler().then(r=>setFavoriler(r.favoriler||[]))}/>
            ))}
          </div>
        ) : (
          <div className="glass p-8 rounded-2xl text-center text-gray-500">
            <TrendingUp size={32} className="mx-auto mb-2 text-gray-600"/>
            <p>Ürünlere göz at, AI sana özel öneriler sunsun!</p>
            <Link to="/urunler" className="btn-primary inline-flex mt-4 text-sm py-2 px-4">
              Ürünleri Keşfet
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
