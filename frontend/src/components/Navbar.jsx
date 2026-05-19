/**
 * components/Navbar.jsx
 * Glassmorphism üst navbar + kategori çubuğu
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Home, ShoppingCart, User, MessageCircle, Star,
  Menu, X, LogOut, Shield, TrendingUp, Package
} from 'lucide-react';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

const NAV_LINKS = [
  { to: '/',          icon: Home,           label: 'Anasayfa'   },
  { to: '/urunler',   icon: TrendingUp,     label: 'Ürünler'    },
  { to: '/sepet',     icon: ShoppingCart,   label: 'Sepet'      },
  { to: '/profil',    icon: User,           label: 'Profil'     },
  { to: '/chat',      icon: MessageCircle,  label: 'AI Asistan' },
  { to: '/admin',     icon: Shield,         label: 'Yönetim'    },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const { kullanici, logout, cart } = useStore();
  const cartCount = cart.reduce((s, u) => s + u.adet, 0);

  const sirketMi = kullanici?.tip === 'sirket';
  const adminMi  = kullanici?.tip === 'admin';
  
  const visibleLinks = NAV_LINKS.filter(l => {
    if (l.to === '/admin') {
      return adminMi;
    }
    if (!kullanici) {
      return l.to !== '/sepet';
    }
    if (sirketMi) {
      return l.to !== '/sepet' && l.to !== '/urunler';
    }
    if (adminMi) {
      return l.to !== '/sepet' && l.to !== '/profil';
    }
    return true;
  });

  const handleLogout = () => {
    logout();
    toast.success('Çıkış yapıldı.');
    navigate('/giris');
    setMobileOpen(false);
  };

  return (
    <header className="navbar sticky top-0 z-50">
      <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand group-hover:scale-110 transition-transform">
            <Wallet size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg text-gradient-brand hidden sm:block">
            CüzdanDostu
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {visibleLinks.map(({ to, icon: Icon, label }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                  ${active ? 'text-brand-400 bg-brand-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Icon size={16} />
                {label}
                {to === '/sepet' && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
                {active && (
                  <motion.div layoutId="nav-pill"
                    className="absolute inset-0 bg-brand-500/10 border border-brand-500/20 rounded-xl -z-10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: user / auth */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 badge-green text-[10px]">
            <Shield size={10} /> KVKK
          </div>

          {kullanici ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-gray-400">{kullanici.ad}</span>
              <button onClick={handleLogout} className="btn-ghost text-red-400 hover:text-red-300 p-2">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link to="/giris" className="hidden md:block btn-primary py-2 px-4 text-sm">
              Giriş Yap
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileOpen(v => !v)}
            className="md:hidden p-2 rounded-xl glass text-gray-400 hover:text-white">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/6 glass-strong"
          >
            <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-4 flex flex-col gap-1">
              {visibleLinks.map(({ to, icon: Icon, label }) => (
                <Link key={to} to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                    ${pathname === to ? 'text-brand-400 bg-brand-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  <Icon size={18} />
                  {label}
                  {to === '/sepet' && cartCount > 0 && (
                    <span className="ml-auto badge-green text-[10px]">{cartCount}</span>
                  )}
                </Link>
              ))}
              <div className="h-px bg-white/6 my-2" />
              {kullanici ? (
                <button onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10">
                  <LogOut size={18} /> Çıkış Yap
                </button>
              ) : (
                <Link to="/giris" onClick={() => setMobileOpen(false)}
                  className="btn-primary text-center text-sm py-3">
                  Giriş Yap / Kayıt Ol
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
