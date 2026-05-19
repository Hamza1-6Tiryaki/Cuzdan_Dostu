/**
 * App.jsx — CüzdanDostu React Router yapısı
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar      from './components/Navbar';
import AuthPage    from './pages/AuthPage';
import HomePage    from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import CartPage    from './pages/CartPage';
import ChatPage    from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import ProductDetailPage from './pages/ProductDetailPage';


export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1520',
              color: '#f1f5f9',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              backdropFilter: 'blur(20px)',
            },
            success: { iconTheme: { primary: '#1a9464', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/giris" element={<AuthPage />} />
          <Route path="/*" element={
            <>
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/"        element={<HomePage />}    />
                  <Route path="/urunler" element={<ProductsPage />} />
                  <Route path="/sepet"   element={<CartPage />}    />
                   <Route path="/chat"    element={<ChatPage />}    />
                  <Route path="/profil"  element={<ProfilePage />} />
                  <Route path="/urun/:id" element={<ProductDetailPage />} />
                  <Route path="*"        element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
