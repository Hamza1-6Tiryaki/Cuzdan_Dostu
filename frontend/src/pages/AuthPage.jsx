/**
 * pages/AuthPage.jsx — Giriş + Kayıt (Müşteri/Şirket) + KVKK
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Mail, Lock, User, Phone, Building2, ChevronRight, Eye, EyeOff, Shield, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';
import { useStore } from '../store/useStore';
import toast from 'react-hot-toast';

const TAB = { GIRIS: 'giris', MUSTERI: 'musteri', SIRKET: 'sirket' };
const KVKK = `KVKK kapsamında finansal verileriniz yalnızca size özel analiz için kullanılır. TC Kimlik, kart ve telefon bilgileri SHA-256 ile şifrelenerek saklanır; üçüncü taraflarla paylaşılmaz. Verilerinize erişim, düzeltme veya silme hakkınız mevcuttur.`;

export default function AuthPage() {
  const [tab, setTab]       = useState(TAB.GIRIS);
  const [loading, setL]     = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showKvkk, setKvkk] = useState(false);
  const [form, setForm]     = useState({
    kullanici_adi:'', email:'', sifre:'', ad_soyad:'', cinsiyet:'', yas:'', telefon:'',
    kurum_adi:'', sirket_kategorisi:'', aciklama:'', kvkk_onay: false,
  });
  const navigate  = useNavigate();
  const setToken  = useStore(s => s.setToken);
  const upd = (k,v) => setForm(f => ({...f,[k]:v}));

  const submit = async (e) => {
    e.preventDefault();
    if (tab !== TAB.GIRIS && !form.kvkk_onay) { toast.error('KVKK onayı gerekli.'); return; }
    setL(true);
    try {
      if (tab === TAB.GIRIS) {
        const d = await authApi.giris({ kullanici_adi: form.kullanici_adi, sifre: form.sifre });
        setToken(d.access_token, { ad: d.ad, tip: d.kullanici_tipi, id: d.kullanici_id });
        toast.success(`Hoş geldin, ${d.ad}! 👋`); navigate('/');
      } else if (tab === TAB.MUSTERI) {
        await authApi.kayitMusteri({
          kullanici_adi: form.kullanici_adi, email: form.email, sifre: form.sifre,
          ad_soyad: form.ad_soyad, cinsiyet: form.cinsiyet || undefined,
          yas: form.yas ? Number(form.yas) : undefined,
          telefon: form.telefon || undefined, kvkk_onay: true,
        });
        toast.success('Kayıt başarılı! Giriş yapabilirsiniz.'); setTab(TAB.GIRIS);
      } else {
        await authApi.kayitSirket({
          kullanici_adi: form.kullanici_adi, email: form.email, sifre: form.sifre,
          kurum_adi: form.kurum_adi, sirket_kategorisi: form.sirket_kategorisi,
          telefon: form.telefon || undefined,
          aciklama: form.aciklama || undefined, kvkk_onay: true,
        });
        toast.success('Şirket kaydı başarılı!'); setTab(TAB.GIRIS);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail;
      toast.error(Array.isArray(msg) ? msg[0]?.msg || 'Hata.' : (msg || 'Bir hata oluştu.'));
    } finally { setL(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-accent-sky/8 blur-3xl animate-pulse-slow" style={{animationDelay:'2s'}} />
      </div>

      <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-gradient shadow-brand mb-4">
            <Wallet size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold font-display text-gradient-brand">CüzdanDostu</h1>
          <p className="text-gray-400 text-sm mt-1">AI Destekli Finansal Alışveriş Asistanı</p>
        </div>

        <div className="glass-strong p-8 rounded-3xl">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-dark-800/60 rounded-xl mb-6">
            {[[TAB.GIRIS,'Giriş'],[TAB.MUSTERI,'Müşteri'],[TAB.SIRKET,'Şirket']].map(([id,label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200
                  ${tab===id ? 'bg-brand-gradient text-white' : 'text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Kullanıcı adı */}
            <div>
              <label className="input-label">Kullanıcı Adı {tab===TAB.GIRIS&&'veya Email'}</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input className="input-field pl-10" placeholder="kullanici_adi"
                  value={form.kullanici_adi} onChange={e=>upd('kullanici_adi',e.target.value)} required />
              </div>
            </div>

            {tab!==TAB.GIRIS && (
              <div>
                <label className="input-label">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input className="input-field pl-10" type="email" placeholder="ornek@email.com"
                    value={form.email} onChange={e=>upd('email',e.target.value)} required />
                </div>
              </div>
            )}

            {/* Şifre */}
            <div>
              <label className="input-label">Şifre</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input className="input-field pl-10 pr-10" type={showPw?'text':'password'} placeholder="••••••••"
                  value={form.sifre} onChange={e=>upd('sifre',e.target.value)} required />
                <button type="button" onClick={()=>setShowPw(v=>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {/* Müşteri alanları */}
            {tab===TAB.MUSTERI && <>
              <div>
                <label className="input-label">Ad Soyad</label>
                <input className="input-field" placeholder="Ahmet Yılmaz"
                  value={form.ad_soyad} onChange={e=>upd('ad_soyad',e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Cinsiyet</label>
                  <select className="input-field" value={form.cinsiyet} onChange={e=>upd('cinsiyet',e.target.value)}>
                    <option value="">Seçiniz</option>
                    <option value="erkek">Erkek</option>
                    <option value="kadin">Kadın</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Yaş</label>
                  <input className="input-field" type="number" min="13" max="120" placeholder="25"
                    value={form.yas} onChange={e=>upd('yas',e.target.value)} />
                </div>
              </div>
              <div>
                <label className="input-label">Telefon (opsiyonel)</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input className="input-field pl-10" placeholder="05XX XXX XX XX"
                    maxLength={11}
                    value={form.telefon} onChange={e=>upd('telefon',e.target.value.replace(/\D/g,'').slice(0,11))} />
                </div>
              </div>
            </>}

            {/* Şirket alanları */}
            {tab===TAB.SIRKET && <>
              <div>
                <label className="input-label">Kurum Adı</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input className="input-field pl-10" placeholder="Firma A.Ş."
                    value={form.kurum_adi} onChange={e=>upd('kurum_adi',e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="input-label">Şirket Kategorisi</label>
                <select className="input-field" value={form.sirket_kategorisi}
                  onChange={e=>upd('sirket_kategorisi',e.target.value)} required>
                  <option value="">Seçiniz</option>
                  {['Teknoloji','Perakende','Gıda','Sağlık','Eğitim','Finans','Diğer'].map(k=>
                    <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Telefon Numarası</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input className="input-field pl-10" placeholder="05XX XXX XX XX"
                    maxLength={11}
                    value={form.telefon} onChange={e=>upd('telefon',e.target.value.replace(/\D/g,'').slice(0,11))} required />
                </div>
              </div>
              <div>
                <label className="input-label">Şirket Açıklaması</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Şirketinizi tanıtın..."
                  value={form.aciklama} onChange={e=>upd('aciklama',e.target.value)} />
              </div>
            </>}

            {/* KVKK */}
            {tab!==TAB.GIRIS && (
              <div className="space-y-2">
                <button type="button" onClick={()=>setKvkk(v=>!v)}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  <Shield size={12}/> KVKK Sözleşmesini {showKvkk?'Gizle':'Görüntüle'}
                </button>
                <AnimatePresence>
                  {showKvkk && (
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}}
                      exit={{opacity:0,height:0}}
                      className="bg-dark-800/60 border border-white/8 rounded-xl p-3 text-xs text-gray-400 leading-relaxed">
                      {KVKK}
                    </motion.div>
                  )}
                </AnimatePresence>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div onClick={()=>upd('kvkk_onay',!form.kvkk_onay)}
                    className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center mt-0.5
                      ${form.kvkk_onay?'bg-brand-500 border-brand-500':'border-gray-600'}`}>
                    {form.kvkk_onay && <CheckCircle2 size={13} className="text-white"/>}
                  </div>
                  <span className="text-xs text-gray-400">KVKK kapsamında verilerimin işlenmesini kabul ediyorum.</span>
                </label>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                : <>{tab===TAB.GIRIS?'Giriş Yap':'Hesap Oluştur'}<ChevronRight size={18}/></>
              }
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4 flex items-center justify-center gap-1">
          <Shield size={10}/> KVKK Uyumlu · Verileriniz güvende
        </p>
      </motion.div>
    </div>
  );
}
