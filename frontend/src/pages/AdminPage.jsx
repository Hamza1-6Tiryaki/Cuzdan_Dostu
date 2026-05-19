/**
 * pages/AdminPage.jsx — CüzdanDostu Sistem Yönetim Paneli (Admin Panel)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Users, ShoppingBag, CreditCard, Tag, BarChart3, 
  Trash2, ToggleLeft, ToggleRight, CheckCircle, Clock, 
  Truck, CheckSquare, XCircle, Search, AlertCircle, RefreshCw
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'dashboard', label: 'Özet Panel', icon: BarChart3 },
  { id: 'users',     label: 'Kullanıcılar', icon: Users },
  { id: 'products',  label: 'Ürün Kataloğu', icon: ShoppingBag },
  { id: 'orders',    label: 'Siparişler',   icon: CreditCard },
  { id: 'coupons',   label: 'İndirim Kuponları', icon: Tag },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const { token, kullanici } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Veri State'leri
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);

  const adminMi = kullanici?.tip === 'admin';

  // Giriş yetkisi kontrolü
  useEffect(() => {
    if (!token || !kullanici) {
      toast.error('Lütfen önce yönetici girişi yapın.');
      navigate('/giris');
    } else if (!adminMi) {
      toast.error('Bu sayfaya erişim yetkiniz bulunmamaktadır.');
      navigate('/');
    }
  }, [token, kullanici, adminMi, navigate]);

  // Tab değişiminde veri çekme tetiklemesi
  useEffect(() => {
    if (adminMi) {
      setSearchTerm('');
      loadTabData();
    }
  }, [activeTab, adminMi]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await adminApi.stats();
        setStats(res);
      } else if (activeTab === 'users') {
        const res = await adminApi.users();
        setUsers(res);
      } else if (activeTab === 'products') {
        const res = await adminApi.products();
        setProducts(res);
      } else if (activeTab === 'orders') {
        const res = await adminApi.orders();
        setOrders(res);
      } else if (activeTab === 'coupons') {
        const res = await adminApi.coupons();
        setCoupons(res);
      }
    } catch (err) {
      toast.error('Veriler yüklenirken hata oluştu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Kullanıcı İşlemleri ──────────────────────────────────────────────────
  const handleToggleUserStatus = async (userId) => {
    try {
      const res = await adminApi.toggleUserStatus(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, aktif: res.aktif } : u));
      toast.success(res.aktif === 1 ? 'Kullanıcı hesabı aktifleştirildi.' : 'Kullanıcı hesabı donduruldu.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kullanıcı durumu değiştirilemedi.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Bu kullanıcıyı ve ilişkili tüm verilerini (bütçe, siparişler, favoriler vs.) silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    try {
      await adminApi.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      toast.success('Kullanıcı başarıyla silindi.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kullanıcı silinemedi.');
    }
  };

  // ─── Ürün İşlemleri ────────────────────────────────────────────────────────
  const handleToggleProductStock = async (productId) => {
    try {
      const res = await adminApi.toggleProductStock(productId);
      setProducts(products.map(p => p.id === productId ? { ...p, stok_var: res.stok_var } : p));
      toast.success(res.stok_var === 1 ? 'Ürün stokta olarak işaretlendi.' : 'Ürün tükendi olarak işaretlendi.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ürün stok durumu değiştirilemedi.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Bu ürünü kalıcı olarak silmek istediğinizden emin misiniz?')) return;
    try {
      await adminApi.deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
      toast.success('Ürün başarıyla silindi.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ürün silinemedi.');
    }
  };

  // ─── Sipariş İşlemleri ──────────────────────────────────────────────────────
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await adminApi.updateOrderStatus(orderId, newStatus);
      setOrders(orders.map(o => o.id === orderId ? { ...o, durum: res.durum } : o));
      toast.success(`Sipariş durumu "${newStatus.toUpperCase()}" olarak güncellendi.`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sipariş durumu güncellenemedi.');
    }
  };

  // ─── Kupon İşlemleri ────────────────────────────────────────────────────────
  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm('Bu indirim kuponunu silmek istediğinizden emin misiniz?')) return;
    try {
      await adminApi.deleteCoupon(couponId);
      setCoupons(coupons.filter(c => c.id !== couponId));
      toast.success('Kupon başarıyla silindi.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kupon silinemedi.');
    }
  };

  if (!kullanici || !adminMi) return null;

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <Shield size={32} className="text-brand-400" /> Sistem Yönetim Paneli
          </h1>
          <p className="text-gray-400 text-sm mt-1">Sistemdeki tüm müşterileri, şirketleri, ürünleri ve siparişleri buradan yönetin.</p>
        </div>
        <button 
          onClick={loadTabData} 
          disabled={loading}
          className="btn-secondary py-2 px-4 flex items-center gap-2 text-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Verileri Yenile
        </button>
      </div>

      {/* Ana Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sol Kolon: Sekme Menüsü */}
        <div className="lg:col-span-3 space-y-2">
          <div className="glass p-4 rounded-3xl space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200
                    ${active 
                      ? 'text-brand-400 bg-brand-500/10 border border-brand-500/20' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          
          {/* Admin Profil Kartı */}
          <div className="glass p-5 rounded-3xl border border-white/5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center font-bold text-brand-400">
                A
              </div>
              <div>
                <p className="font-semibold text-sm">{kullanici.ad}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Sistem Yöneticisi</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ Kolon: İçerik Bölümü */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Arama Alanı (Dashboard hariç tüm sekmelerde gösterilir) */}
          {activeTab !== 'dashboard' && (
            <div className="relative w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Arama yapın (Kullanıcı adı, ürün, kategori...)"
                className="input-field pl-12 py-3 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {/* Loader */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Dinamik İçerik Görünümü */}
          {!loading && (
            <div className="space-y-6">
              
              {/* Sekme 1: Dashboard Panel */}
              {activeTab === 'dashboard' && stats && (
                <div className="space-y-6">
                  {/* Kartlar Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Kart 1: Müşteriler */}
                    <div className="glass p-6 rounded-3xl flex items-center gap-4 border border-white/5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Users size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Toplam Müşteri</p>
                        <p className="text-2xl font-bold mt-1 text-white">{stats.musteri_sayisi}</p>
                      </div>
                    </div>

                    {/* Kart 2: Şirketler */}
                    <div className="glass p-6 rounded-3xl flex items-center gap-4 border border-white/5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Shield size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Kayıtlı Şirket</p>
                        <p className="text-2xl font-bold mt-1 text-white">{stats.sirket_sayisi}</p>
                      </div>
                    </div>

                    {/* Kart 3: Ürünler */}
                    <div className="glass p-6 rounded-3xl flex items-center gap-4 border border-white/5">
                      <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
                        <ShoppingBag size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Toplam Ürün</p>
                        <p className="text-2xl font-bold mt-1 text-white">{stats.urun_sayisi}</p>
                      </div>
                    </div>

                    {/* Kart 4: Toplam Kazanç */}
                    <div className="glass p-6 rounded-3xl flex items-center gap-4 border border-white/5">
                      <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Toplam Sipariş Tutarı</p>
                        <p className="text-xl font-bold mt-1 text-gradient-brand">₺{stats.toplam_kazanc?.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>

                  </div>

                  {/* Son Siparişler Tablosu */}
                  <div className="glass p-6 rounded-3xl border border-white/5">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Clock size={18} className="text-brand-400" /> Sistemdeki Son Siparişler
                    </h3>
                    
                    {stats.recent_orders?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-white/8 text-gray-400 font-semibold">
                              <th className="pb-3">Sipariş ID</th>
                              <th className="pb-3">Kullanıcı</th>
                              <th className="pb-3">Tarih</th>
                              <th className="pb-3">Tutar</th>
                              <th className="pb-3">Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.recent_orders.map((order) => {
                              let statusBadge = 'badge-yellow';
                              if (order.durum === 'teslim_edildi' || order.durum === 'onaylandi') statusBadge = 'badge-green';
                              if (order.durum === 'iptal') statusBadge = 'badge-red';
                              
                              return (
                                <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/1">
                                  <td className="py-3.5 font-bold text-white">#{order.id}</td>
                                  <td className="py-3.5 text-gray-300">{order.kullanici_adi}</td>
                                  <td className="py-3.5 text-gray-400 text-xs">
                                    {new Date(order.olusturuldu).toLocaleDateString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-3.5 font-bold text-brand-400">₺{order.toplam_tutar?.toLocaleString('tr-TR')}</td>
                                  <td className="py-3.5">
                                    <span className={`${statusBadge} uppercase text-[9px] font-bold`}>{order.durum}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic py-4">Henüz sistemde sipariş kaydı bulunmuyor.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Sekme 2: Kullanıcılar */}
              {activeTab === 'users' && (
                <div className="glass p-6 rounded-3xl border border-white/5">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Users size={18} className="text-brand-400" /> Tüm Müşteriler ve Kurumlar
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-white/8 text-gray-400 font-semibold">
                          <th className="pb-3">Kullanıcı Adı / E-mail</th>
                          <th className="pb-3">İsim / Kurum</th>
                          <th className="pb-3">Tip</th>
                          <th className="pb-3 text-center">Durum</th>
                          <th className="pb-3 text-right">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users
                          .filter(u => 
                            u.kullanici_adi.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (u.ad_soyad || u.kurum_adi || '').toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((u) => (
                            <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/1">
                              <td className="py-3.5">
                                <p className="font-bold text-white">{u.kullanici_adi}</p>
                                <p className="text-xs text-gray-500">{u.email}</p>
                              </td>
                              <td className="py-3.5 text-gray-300">
                                {u.tip === 'musteri' ? u.ad_soyad : u.kurum_adi}
                              </td>
                              <td className="py-3.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                                  ${u.tip === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                    u.tip === 'sirket' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                    'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}
                                >
                                  {u.tip}
                                </span>
                              </td>
                              <td className="py-3.5 text-center">
                                <span className={`text-[9px] font-bold ${u.aktif === 1 ? 'badge-green' : 'badge-red'}`}>
                                  {u.aktif === 1 ? 'AKTİF' : 'DONDURULDU'}
                                </span>
                              </td>
                              <td className="py-3.5 text-right space-x-2">
                                {u.tip !== 'admin' && (
                                  <>
                                    <button 
                                      onClick={() => handleToggleUserStatus(u.id)}
                                      className={`p-1.5 rounded-lg border transition-all text-xs inline-flex items-center gap-1
                                        ${u.aktif === 1 
                                          ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' 
                                          : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'}`}
                                    >
                                      {u.aktif === 1 ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                                      <span>{u.aktif === 1 ? 'Dondur' : 'Aktif Et'}</span>
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 inline-flex items-center"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sekme 3: Ürün Kataloğu */}
              {activeTab === 'products' && (
                <div className="glass p-6 rounded-3xl border border-white/5">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <ShoppingBag size={18} className="text-brand-400" /> Ürün Kataloğu Moderasyonu
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-white/8 text-gray-400 font-semibold">
                          <th className="pb-3">Ürün Tanımı</th>
                          <th className="pb-3">Kategori</th>
                          <th className="pb-3">Fiyat</th>
                          <th className="pb-3">Şirket / Site</th>
                          <th className="pb-3 text-center">Stok</th>
                          <th className="pb-3 text-right">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products
                          .filter(p => 
                            p.ad.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.marka.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            p.kategori.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.sirket_adi || '').toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((p) => (
                            <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/1">
                              <td className="py-3">
                                <div className="flex items-center gap-3">
                                  <img 
                                    src={p.resim_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'} 
                                    alt={p.ad} 
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-dark-700 border border-white/5"
                                    onError={e => e.target.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                                  />
                                  <div>
                                    <p className="font-bold text-white line-clamp-1">{p.ad}</p>
                                    <p className="text-xs text-gray-500">{p.marka}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 text-gray-300 text-xs">{p.kategori}</td>
                              <td className="py-3 font-bold text-brand-400">₺{p.fiyat?.toLocaleString('tr-TR')}</td>
                              <td className="py-3">
                                <p className="text-gray-300 text-xs font-semibold">{p.sirket_adi || 'Sistem'}</p>
                                <p className="text-[10px] text-gray-500">{p.site}</p>
                              </td>
                              <td className="py-3 text-center">
                                <span className={`text-[9px] font-bold ${p.stok_var === 1 ? 'badge-green' : 'badge-red'}`}>
                                  {p.stok_var === 1 ? 'STOKTA' : 'TÜKENDİ'}
                                </span>
                              </td>
                              <td className="py-3 text-right space-x-2">
                                <button 
                                  onClick={() => handleToggleProductStock(p.id)}
                                  className={`p-1.5 rounded-lg border transition-all text-xs inline-flex items-center gap-1
                                    ${p.stok_var === 1 
                                      ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' 
                                      : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'}`}
                                >
                                  {p.stok_var === 1 ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                                  <span>{p.stok_var === 1 ? 'Kapat' : 'Aç'}</span>
                                </button>
                                <button 
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 inline-flex items-center"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sekme 4: Siparişler */}
              {activeTab === 'orders' && (
                <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
                  <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <CreditCard size={18} className="text-brand-400" /> Siparişlerin Sevkiyat ve Durum Kontrolü
                  </h3>

                  {orders
                    .filter(o => 
                      o.kullanici_adi.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      o.id.toString().includes(searchTerm) ||
                      o.durum.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((order) => {
                      let statusColor = 'text-yellow-400';
                      if (order.durum === 'teslim_edildi' || order.durum === 'onaylandi') statusColor = 'text-emerald-400';
                      if (order.durum === 'iptal') statusColor = 'text-red-400';

                      return (
                        <div key={order.id} className="glass p-5 rounded-2xl border border-white/5 space-y-4">
                          {/* Sipariş Üst Bilgileri */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-white/5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-base">Sipariş #{order.id}</span>
                                <span className="text-xs text-gray-500">· {order.kullanici_adi} ({order.email})</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(order.olusturuldu).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            
                            {/* Durum Değiştirme */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">Durum:</span>
                              <select 
                                value={order.durum}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                className="bg-dark-800 border border-white/10 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
                              >
                                <option value="beklemede">Beklemede 🕒</option>
                                <option value="onaylandi">Onaylandı ✓</option>
                                <option value="kargoda">Kargoda 🚚</option>
                                <option value="teslim_edildi">Teslim Edildi 🎉</option>
                                <option value="iptal">İptal Edildi ✕</option>
                              </select>
                            </div>
                          </div>

                          {/* Ürünler Listesi */}
                          <div className="space-y-2 text-xs">
                            {order.urunler?.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-gray-300">
                                <span>{item.marka} {item.ad} <strong className="text-gray-500">x{item.adet}</strong></span>
                                <span className="font-semibold text-white">₺{(item.birim_fiyat * item.adet).toLocaleString('tr-TR')}</span>
                              </div>
                            ))}
                          </div>

                          {/* Sipariş Toplam */}
                          <div className="flex justify-between items-center pt-3 border-t border-white/5">
                            <span className="text-xs text-gray-500">Ödeme Detayı: Taksit/Tek Çekim</span>
                            <span className="text-base font-bold text-brand-400">
                              Toplam Tutar: ₺{order.toplam_tutar?.toLocaleString('tr-TR')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              )}

              {/* Sekme 5: İndirim Kuponları */}
              {activeTab === 'coupons' && (
                <div className="glass p-6 rounded-3xl border border-white/5">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Tag size={18} className="text-brand-400" /> Tanımlı İndirim Kuponları
                  </h3>

                  {coupons.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-white/8 text-gray-400 font-semibold">
                            <th className="pb-3">Kupon Kodu</th>
                            <th className="pb-3">İndirim Oranı</th>
                            <th className="pb-3">Veren Şirket</th>
                            <th className="pb-3">Son Geçerlilik</th>
                            <th className="pb-3 text-center">Kullanım Durumu</th>
                            <th className="pb-3 text-right">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coupons
                            .filter(c => 
                              c.kod.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              c.sirket_adi.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map((c) => (
                              <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/1">
                                <td className="py-3.5 font-bold text-emerald-400 uppercase tracking-widest">{c.kod}</td>
                                <td className="py-3.5 font-bold text-white">%{c.indirim_yuzde}</td>
                                <td className="py-3.5 text-gray-300">{c.sirket_adi}</td>
                                <td className="py-3.5 text-gray-400 text-xs">{c.gecerlilik}</td>
                                <td className="py-3.5 text-center">
                                  <span className={`text-[9px] font-bold ${c.kullanildi === 1 ? 'badge-red' : 'badge-green'}`}>
                                    {c.kullanildi === 1 ? 'KULLANILDI' : 'AKTİF'}
                                  </span>
                                </td>
                                <td className="py-3.5 text-right">
                                  <button 
                                    onClick={() => handleDeleteCoupon(c.id)}
                                    className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 inline-flex items-center"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          }
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic py-4">Sistemde kayıtlı aktif bir kupon bulunmuyor.</p>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
