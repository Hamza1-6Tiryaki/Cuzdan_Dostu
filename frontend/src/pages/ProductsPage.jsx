/**
 * pages/ProductsPage.jsx — Ürünler + Kategori Navbar
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productApi } from '../services/api';
import { useStore } from '../store/useStore';
import ProductCard from '../components/ProductCard';

const KATEGORILER = [
  {emoji:'🌟',label:'Tümü',value:''},
  {emoji:'👗',label:'Kadın',value:'Kadın'},
  {emoji:'👔',label:'Erkek',value:'Erkek'},
  {emoji:'👶',label:'Anne & Çocuk',value:'Anne & Çocuk'},
  {emoji:'🧸',label:'Oyuncak',value:'Oyuncak'},
  {emoji:'👟',label:'Ayakkabı & Çanta',value:'Ayakkabı & Çanta'},
  {emoji:'🏠',label:'Ev & Yaşam',value:'Ev & Yaşam'},
  {emoji:'🛒',label:'Market',value:'Market'},
  {emoji:'💄',label:'Kozmetik',value:'Kozmetik'},
  {emoji:'📱',label:'Elektronik',value:'Elektronik'},
  {emoji:'⚽',label:'Spor',value:'Spor'},
  {emoji:'💎',label:'Aksesuar',value:'Aksesuar'},
];

export default function ProductsPage() {
  const navigate = useNavigate();
  const { token, kullanici } = useStore();
  const sirketMi = kullanici?.tip === 'sirket';

  useEffect(() => {
    if (sirketMi) {
      navigate('/profil');
    }
  }, [sirketMi, navigate]);
  const [urunler,    setUrunler]  = useState([]);
  const [favoriler,  setFavoriler]= useState([]);
  const [kategori,   setKategori] = useState('');
  const [arama,      setArama]    = useState('');
  const [aramaInput, setAramaInput]= useState('');
  const [loading,    setLoading]  = useState(true);
  const [sayfa,      setSayfa]    = useState(0);
  const LIMIT = 20;

  const loadFavoriler = useCallback(async () => {
    if (!token) return;
    try { const r = await productApi.favoriler(); setFavoriler(r.favoriler || []); } catch {}
  }, [token]);

  const loadUrunler = useCallback(async (kat, ara, offset) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (kat) params.kategori = kat;
      if (ara) params.arama   = ara;
      const r = await productApi.liste(params);
      setUrunler(r.urunler || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFavoriler(); }, [loadFavoriler]);
  useEffect(() => { setSayfa(0); loadUrunler(kategori, arama, 0); }, [kategori, arama, loadUrunler]);

  const handleArama = (e) => { e.preventDefault(); setArama(aramaInput); };

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8 space-y-6">
      {/* Başlık + Arama */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-gradient-brand">Ürünler</h1>
          <p className="text-gray-400 text-sm mt-1">{kategori || 'Tüm kategoriler'}</p>
        </div>
        <form onSubmit={handleArama} className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
            <input className="input-field pl-10 pr-10 py-2.5 text-sm" placeholder="Ürün ara..."
              value={aramaInput} onChange={e=>setAramaInput(e.target.value)}/>
            {aramaInput && (
              <button type="button" onClick={()=>{setAramaInput('');setArama('');}}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={14}/>
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary py-2.5 px-4 text-sm">Ara</button>
        </form>
      </div>

      {/* Kategori Pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {KATEGORILER.map(({emoji,label,value}) => (
          <button key={value} onClick={()=>setKategori(value)}
            className={`cat-pill ${kategori===value?'active':''}`}>
            <span>{emoji}</span>{label}
          </button>
        ))}
      </div>

      {/* Ürün grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_,i) => <div key={i} className="skeleton h-72 w-full"/>)}
        </div>
      ) : urunler.length === 0 ? (
        <div className="glass p-16 rounded-2xl text-center text-gray-500">
          <SlidersHorizontal size={40} className="mx-auto mb-3 text-gray-600"/>
          <p className="text-lg">Bu kategoride ürün bulunamadı.</p>
        </div>
      ) : (
        <motion.div initial={{opacity:0}} animate={{opacity:1}}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {urunler.map((u,i) => (
            <motion.div key={u.id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
              transition={{delay: i*0.04}}>
              <ProductCard urun={u} favoriler={favoriler} onFavoriChange={loadFavoriler}/>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Sayfalama */}
      {!loading && urunler.length === LIMIT && (
        <div className="flex justify-center gap-3">
          {sayfa > 0 && (
            <button className="btn-secondary" onClick={()=>{const p=sayfa-1;setSayfa(p);loadUrunler(kategori,arama,p*LIMIT);}}>
              ← Önceki
            </button>
          )}
          <button className="btn-primary" onClick={()=>{const p=sayfa+1;setSayfa(p);loadUrunler(kategori,arama,p*LIMIT);}}>
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}
