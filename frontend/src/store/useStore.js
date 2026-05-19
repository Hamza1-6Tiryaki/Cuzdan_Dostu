/**
 * store/useStore.js
 * Zustand global state — auth, cart, UI
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Auth ─────────────────────────────────────────────────
      token:     null,
      kullanici: null,
      setToken:  (token, kullanici) => set({ token, kullanici }),
      logout:    () => set({ token: null, kullanici: null, budget: null }),

      // ── Budget ───────────────────────────────────────────────
      budget: null,
      setBudget: (budget) => set({ budget }),

      // ── Cart ─────────────────────────────────────────────────
      cart: [],
      addToCart: (urun) => {
        const { cart } = get();
        const mevcut = cart.find(u => u.urun_id === urun.urun_id);
        if (mevcut) {
          set({ cart: cart.map(u => u.urun_id === urun.urun_id ? { ...u, adet: u.adet + 1 } : u) });
        } else {
          set({ cart: [...cart, { ...urun, adet: 1 }] });
        }
      },
      removeFromCart: (urun_id) => set({ cart: get().cart.filter(u => u.urun_id !== urun_id) }),
      updateCartQty:  (urun_id, adet) => {
        if (adet <= 0) { get().removeFromCart(urun_id); return; }
        set({ cart: get().cart.map(u => u.urun_id === urun_id ? { ...u, adet } : u) });
      },
      clearCart: () => set({ cart: [] }),
      cartTotal: () => get().cart.reduce((s, u) => s + u.fiyat * u.adet, 0),

      // ── UI ───────────────────────────────────────────────────
      sidebarOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
    }),
    {
      name: 'cuzdan-store',
      partialize: (s) => ({ token: s.token, kullanici: s.kullanici, cart: s.cart, budget: s.budget }),
    }
  )
);
