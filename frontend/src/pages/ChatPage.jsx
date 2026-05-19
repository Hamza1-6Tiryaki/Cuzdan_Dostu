/**
 * pages/ChatPage.jsx — AI Finansal Chatbot
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Wallet, TrendingUp, Star, Zap } from 'lucide-react';
import { aiApi } from '../services/api';
import { useStore } from '../store/useStore';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

const HIZLI_MUSTERI = [
  '💰 Bütçemi nasıl değerlendiriyorsun?',
  '🛒 Sepetimi analiz et',
  '📊 Hangi kategoride çok harcıyorum?',
  '💎 Birikim önerilerin neler?',
  '📈 Trend yatırım sektörleri neler?',
  '🔖 Favorilerimden ne almalıyım?',
];

const HIZLI_SIRKET = [
  '💼 Sermayemi ve kârlılığımı analiz et',
  '📈 Gelecek nakit akışı öngörüleri neler?',
  '📊 Hedef kâr marjını nasıl artırabilirim?',
  '💸 İşletme sermayemizi nasıl koruruz?',
  '🛡️ Finansal borçlanma risk analizi yap',
  '💎 Şirket büyümesi için nereye yatırım yapmalıyım?',
];

function Mesaj({ mesaj }) {
  const isUser = mesaj.rol === 'kullanici';
  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
      className={`flex gap-3 ${isUser?'flex-row-reverse':''}`}>
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center
        ${isUser?'bg-brand-gradient':'bg-dark-600 border border-white/10'}`}>
        {isUser ? <User size={14} className="text-white"/> : <Bot size={14} className="text-brand-400"/>}
      </div>
      <div className={`max-w-[80%] space-y-2 ${isUser?'items-end flex flex-col':''}`}>
        <div className={isUser?'bubble-user':'bubble-ai'}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{mesaj.icerik}</p>
        </div>
        {/* Risk badge */}
        {mesaj.risk_seviyesi && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full
            ${mesaj.risk_seviyesi==='dusuk'?'badge-green':mesaj.risk_seviyesi==='yuksek'?'badge-red':'badge-yellow'}`}>
            {mesaj.risk_seviyesi==='dusuk'?'Düşük Risk':mesaj.risk_seviyesi==='yuksek'?'Yüksek Risk':'Orta Risk'}
          </span>
        )}
        {/* Öneriler */}
        {mesaj.onerileri?.length > 0 && (
          <div className="glass p-3 rounded-xl space-y-1 w-full">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Öneriler</p>
            {mesaj.onerileri.map((o,i) => (
              <p key={i} className="text-xs text-gray-300 flex gap-2">
                <Star size={10} className="text-yellow-400 flex-shrink-0 mt-0.5"/>
                {o}
              </p>
            ))}
          </div>
        )}
        {/* Ödeme alternatifleri */}
        {mesaj.odeme_alternatifleri?.length > 0 && (
          <div className="glass p-3 rounded-xl w-full">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Ödeme Seçenekleri</p>
            <div className="space-y-1.5">
              {mesaj.odeme_alternatifleri.slice(0,3).map((p,i) => (
                <div key={i} className="flex justify-between text-xs bg-dark-700/50 rounded-lg px-3 py-2">
                  <span className="text-gray-300">{p.plan_adi}</span>
                  <span className="text-brand-400 font-bold">₺{p.aylik_taksit?.toLocaleString('tr-TR')}/ay</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ChatPage() {
  const { token, budget, cart, kullanici } = useStore();
  const sirketMi = kullanici?.tip === 'sirket';
  const location = useLocation();
  const locationState = location.state;

  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (token) {
      const baslangicIcerik = sirketMi
        ? 'Merhaba! Ben CüzdanDostu Kurumsal Finansal Yapay Zekâ Asistanınızım. 💼\n\nŞirketinizin sermayesini, kârlılık oranlarını, nakit akışını analiz edebilir ve kurumsal finansal kararlarınızda büyümenizi destekleyecek öneriler sunabilirim. Şirketinizin geleceği ve finansmanı için nasıl yardımcı olabilirim?'
        : 'Merhaba! Ben CüzdanDostu AI asistanınızım. 💰\n\nBütçenizi analiz edebilir, alışveriş önerileri sunabilir ve finansal kararlarınızda yol gösterebilirim. Size nasıl yardımcı olabilirim?';
      setMessages([{ rol: 'asistan', icerik: baslangicIcerik }]);
    }
  }, [token, sirketMi]);

  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const hizliSorular = sirketMi ? HIZLI_SIRKET : HIZLI_MUSTERI;

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    if (!token) { toast.error('Önce giriş yapın.'); return; }
    setInput('');
    const userMsg = { rol:'kullanici', icerik: msg };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    try {
      const gecmis = messages.map(m => ({ rol: m.rol, icerik: m.icerik }));
      const r = await aiApi.chat({ mesaj: msg, gecmis, sepet: cart });
      setMessages(m => [...m, {
        rol:'asistan', icerik: r.yanit,
        risk_seviyesi: r.risk_seviyesi,
        onerileri: r.onerileri,
        odeme_alternatifleri: r.odeme_alternatifleri,
      }]);
    } catch { toast.error('AI yanıt veremedi.'); }
    finally { setLoading(false); }
  };

  // Dynamic initial message trigger from ProductDetailPage navigation
  useEffect(() => {
    if (locationState?.urunSohbetPrompt && token) {
      const timer = setTimeout(() => {
        send(locationState.urunSohbetPrompt);
        // Clear history state so refresh doesn't trigger it again
        window.history.replaceState({}, document.title);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [locationState, token]);

  if (!token) return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-16 text-center">
      <div className="glass p-12 rounded-3xl">
        <Bot size={56} className="mx-auto mb-4 text-brand-400"/>
        <h2 className="text-2xl font-bold mb-2">AI Asistana Hoş Geldin</h2>
        <p className="text-gray-400 mb-6">Finansal danışmanlık için giriş yapman gerekiyor.</p>
        <Link to="/giris" className="btn-primary inline-flex items-center gap-2">
          Giriş Yap <Zap size={18}/>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-6 flex flex-col" style={{height:'calc(100vh - 4rem)'}}>
      {/* Header */}
      <div className="glass-strong p-4 rounded-2xl mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
          <Bot size={20} className="text-white"/>
        </div>
        <div>
          <h1 className="font-bold text-gradient-brand">CüzdanDostu AI</h1>
          <p className="text-xs text-gray-400">Finansal Asistan · Gemini 2.0 Flash</p>
        </div>
        {budget && (
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">Kullanılabilir</p>
            <p className="text-sm font-bold text-brand-400">₺{budget.kullanilabilir_butce?.toLocaleString('tr-TR')}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((m,i) => <Mesaj key={i} mesaj={m}/>)}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-dark-600 border border-white/10 flex items-center justify-center">
              <Bot size={14} className="text-brand-400"/>
            </div>
            <div className="bubble-ai">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Hızlı sorular */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3">
        {hizliSorular.map(h => (
          <button key={h} onClick={()=>send(h)} disabled={loading}
            className="glass flex-shrink-0 px-3 py-1.5 rounded-xl text-xs text-gray-300 hover:text-white hover:border-brand-500/40 transition-all whitespace-nowrap">
            {h}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={e=>{e.preventDefault();send();}} className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Finansal durumunuz hakkında soru sorun..."
          value={input}
          onChange={e=>setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading||!input.trim()} className="btn-primary px-4 py-3 flex-shrink-0">
          <Send size={18}/>
        </button>
      </form>
    </div>
  );
}
