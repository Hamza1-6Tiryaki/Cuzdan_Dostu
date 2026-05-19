import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Development helper: if VITE_DEV_TOKEN is set, inject it only when no auth state exists.
// This avoids overwriting an existing valid session with a stale token.
if (import.meta.env. VITE_DEV_TOKEN) {
  try {
    const existing = localStorage.getItem('cuzdan-store');
    if (!existing) {
      const state = {
        token: import.meta.env.VITE_DEV_TOKEN,
        kullanici: { id: 5, kullanici_adi: 'dev_test', ad: 'Dev Test' }
      };
      localStorage.setItem('cuzdan-store', JSON.stringify(state));
      // eslint-disable-next-line no-console
      console.info('Dev token injected into localStorage (VITE_DEV_TOKEN).');
    } else {
      // eslint-disable-next-line no-console
      console.info('Existing auth state found, VITE_DEV_TOKEN injection skipped.');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to inject dev token:', e);
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
