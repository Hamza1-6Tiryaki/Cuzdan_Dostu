/**
 * components/ProductCard.jsx
 * Ürün kartı — favori, sepet, stok durumu
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Star, ExternalLink, Package } from 'lucide-react';
import { useStore } from '../store/useStore';
import { productApi } from '../services/api';
import toast from 'react-hot-toast';

const FALLBACK = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

export default function ProductCard({ urun, favoriler = [], onFavoriChange }) {
  const navigate = useNavigate();
  const { addToCart, token, kullanici } = useStore();
  const [imgErr, setImgErr]   = useState(false);
  const [loading, setLoading] = useState(false);

  const sirketMi = kullanici?.tip === 'sirket';
  const isFav = favoriler.some(f => f.referans_id === urun.id && f.tur === 'urun');

  const handleFavori = async (e) => {
    e.stopPropagation();
    if (!token) { toast.error('Önce giriş yapın.'); return; }
    setLoading(true);
    try {
      if (isFav) {
        await productApi.favoriCikar('urun', urun.id);
        toast.success('Favorilerden çıkarıldı.');
      } else {
        await productApi.favoriEkle({ tur: 'urun', referans_id: urun.id, ad: urun.ad });
        toast.success('Favorilere eklendi! ❤️');
      }
      onFavoriChange?.();
    } catch { toast.error('Bir hata oluştu.'); }
    finally { setLoading(false); }
  };

  const handleSepet = (e) => {
    e.stopPropagation();
    if (!token || !kullanici) {
      toast.error('Sepete ürün eklemek için önce giriş yapmalısınız.');
      navigate('/giris');
      return;
    }
    addToCart({
      urun_id: urun.id, ad: urun.ad, fiyat: urun.fiyat,
      kategori: urun.kategori, marka: urun.marka,
      site: urun.site, resim_url: urun.resim_url,
    });
    toast.success(`${urun.ad} sepete eklendi! 🛒`);
  };

  const handleGoruntule = async () => {
    if (token) productApi.goruntule(urun.id).catch(() => {});
    navigate(`/urun/${urun.id}`);
  };

  return (
    <motion.div
      className="product-card group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleGoruntule}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      {/* Image */}
      <div className="relative overflow-hidden h-48 bg-dark-700">
        {imgErr || !urun.resim_url ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-dark-800 text-gray-500">
            <Package size={36} className="text-gray-600 mb-1 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-xs text-gray-500">Görsel Belirtilmedi</span>
          </div>
        ) : (
          <img
            src={urun.resim_url}
            alt={urun.ad}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        )}
        {/* Stok badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-bold
          ${urun.stok_var ? 'bg-brand-500/90 text-white' : 'bg-red-600/90 text-white'}`}>
          {urun.stok_var ? 'Stokta' : 'Tükendi'}
        </div>
        {/* Favori btn */}
        {!sirketMi && (
          <button
            onClick={handleFavori}
            disabled={loading}
            className={`absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center
              transition-all duration-200 backdrop-blur-sm
              ${isFav ? 'bg-red-500/80 text-white' : 'bg-dark-800/70 text-gray-400 hover:text-red-400 hover:bg-dark-700/80'}`}
          >
            <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
          </button>
        )}
        {/* Site */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-dark-900/80 text-[10px] text-gray-300 backdrop-blur-sm">
          {urun.site}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-brand-400 font-medium">{urun.marka}</p>
            <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-snug mt-0.5">
              {urun.ad}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 text-yellow-400">
          <Star size={11} fill="currentColor" />
          <span className="text-xs text-gray-400">{urun.puan?.toFixed(1)}</span>
          <span className="text-[10px] text-gray-600 ml-1">{urun.kategori}</span>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span className="text-lg font-bold text-gradient-brand">
            ₺{urun.fiyat?.toLocaleString('tr-TR')}
          </span>
          {!sirketMi && (
            <button
              onClick={handleSepet}
              disabled={!urun.stok_var}
              className="flex items-center gap-1.5 bg-brand-500/20 border border-brand-500/30 text-brand-400
                hover:bg-brand-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShoppingCart size={12} />
              Sepete Ekle
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
