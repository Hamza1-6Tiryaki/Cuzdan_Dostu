/**
 * services/api.js
 * FastAPI backend ile iletişim katmanı — Axios tabanlı.
 */
import axios from 'axios';
import { useStore } from '../store/useStore';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

// Token enjeksiyonu
api.interceptors.request.use(cfg => {
  const raw = localStorage.getItem('cuzdan-store');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const state = parsed.state ?? parsed;
      if (state?.token) {
        cfg.headers.Authorization = `Bearer ${state.token}`;
      } else {
        if (import.meta.env.DEV) console.error('api: no token found in localStorage auth state');
      }
      if (import.meta.env.DEV) console.error('api: request Authorization header=', cfg.headers.Authorization);
    } catch (parseError) {
      if (import.meta.env.DEV) console.error('api: failed to parse localStorage auth state', parseError);
    }
  }
  return cfg;
});

// Response logging for debugging auth headers and statuses
api.interceptors.response.use(
  (res) => {
    if (import.meta.env.DEV) console.error('api: response', res.status, res.config?.url);
    return res;
  },
  (err) => {
    const r = err.response;
    if (import.meta.env.DEV) {
      console.error('api: response error', r?.status, err.config?.url, r?.headers, r?.data);
    }
    if (r?.status === 401) {
      useStore.getState().logout();
      if (import.meta.env.DEV && import.meta.env.VITE_DEV_TOKEN) {
        console.warn('Stale VITE_DEV_TOKEN detected. Cached auth state cleared and logged out. Please log in again.');
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  giris:         (d) => api.post('/api/auth/giris', d).then(r => r.data),
  kayitMusteri:  (d) => api.post('/api/auth/kayit/musteri', d).then(r => r.data),
  kayitSirket:   (d) => api.post('/api/auth/kayit/sirket', d).then(r => r.data),
  ben:           ()  => api.get('/api/auth/ben').then(r => r.data),
};

// ── Products ─────────────────────────────────────────────────────────────────
export const productApi = {
  liste:      (params) => api.get('/api/urunler/', { params }).then(r => r.data),
  detay:      (id)     => api.get(`/api/urunler/${id}`).then(r => r.data),
  muadilBul:  (id)     => api.get(`/api/urunler/muadil/${id}`).then(r => r.data),
  kategoriler:()       => api.get('/api/urunler/kategoriler').then(r => r.data),
  goruntule:  (id)     => api.post(`/api/urunler/goruntule/${id}`).then(r => r.data),
  gecmis:     ()       => api.get('/api/urunler/kullanici/gecmis').then(r => r.data),
  favoriler:  ()       => api.get('/api/urunler/kullanici/favoriler').then(r => r.data),
  favoriEkle: (d)      => api.post('/api/urunler/favori', d).then(r => r.data),
  favoriCikar:(tur,id) => api.delete(`/api/urunler/favori/${tur}/${id}`).then(r => r.data),
  
  // Şirket Metodları
  sirketUrunleri: ()   => api.get('/api/urunler/sirket').then(r => r.data),
  sirketUrunEkle: (d)  => api.post('/api/urunler', d).then(r => r.data),
  sirketUrunSil:  (id) => api.delete(`/api/urunler/${id}`).then(r => r.data),
  fiyatAnaliz:    (d)  => api.post('/api/urun/fiyat-analiz', d).then(r => r.data),
};

// ── Budget ───────────────────────────────────────────────────────────────────
export const budgetApi = {
  kaydet:     (d)      => api.post('/api/butce', d).then(r => r.data),
  getir:      ()       => api.get('/api/butce').then(r => r.data),
  siparisler: ()       => api.get('/api/siparisler').then(r => r.data),
  siparisTan: (payload)  => api.post('/api/siparisler', payload).then(r => r.data),
  sepetKuponlari: (ids)  => api.post('/api/sepet/kuponlar', { urun_ids: ids }).then(r => r.data),
  aylikRapor: (y, a)   => api.get(`/api/rapor/aylik/${y}/${a}`).then(r => r.data),
  yillikRapor:(y)      => api.get(`/api/rapor/yillik/${y}`).then(r => r.data),
  profil:     ()       => api.get('/api/profil').then(r => r.data),
  profilGuncelle: (d)  => api.put('/api/profil', d).then(r => r.data),
  oneriler:   ()       => api.get('/api/oneriler').then(r => r.data),
  kuponlar:   ()       => api.get('/api/kuponlar').then(r => r.data),
  
  // Şirket Kupon Ekleme
  kuponEkle:  (d)      => api.post('/api/kuponlar', d).then(r => r.data),
};

// ── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  chat:        (d) => api.post('/api/chat', d).then(r => r.data),
  sepetAnaliz: (d) => api.post('/api/sepet/analiz', d).then(r => r.data),
};

// ── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  stats:               () => api.get('/api/admin/stats').then(r => r.data),
  users:               () => api.get('/api/admin/users').then(r => r.data),
  toggleUserStatus:    (id) => api.put(`/api/admin/users/${id}/status`).then(r => r.data),
  deleteUser:          (id) => api.delete(`/api/admin/users/${id}`).then(r => r.data),
  products:            () => api.get('/api/admin/products').then(r => r.data),
  toggleProductStock:  (id) => api.put(`/api/admin/products/${id}/stok`).then(r => r.data),
  deleteProduct:       (id) => api.delete(`/api/admin/products/${id}`).then(r => r.data),
  orders:              () => api.get('/api/admin/orders').then(r => r.data),
  updateOrderStatus:   (id, durum) => api.put(`/api/admin/orders/${id}/durum`, { durum }).then(r => r.data),
  coupons:             () => api.get('/api/admin/coupons').then(r => r.data),
  deleteCoupon:        (id) => api.delete(`/api/admin/coupons/${id}`).then(r => r.data),
};

export default api;
