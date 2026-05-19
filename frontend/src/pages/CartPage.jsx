/**
 * pages/CartPage.jsx — Sepet + Bütçeye Göre Ayarla + Ödeme Aşaması
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Trash2, Plus, Minus, Wallet, Zap, Star, 
  ArrowRight, Sparkles, CreditCard, Lock, CheckCircle, 
  Calendar, User, HelpCircle, ArrowLeft 
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { aiApi, productApi, budgetApi } from '../services/api';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { cart, removeFromCart, updateCartQty, clearCart, cartTotal, budget, token, kullanici, setBudget } = useStore();
  const navigate = useNavigate();
  const [analiz,   setAnaliz]  = useState(null);
  const [loading,  setLoading] = useState(false);
  const [muadilLoading, setMuadilLoading] = useState(false);

  // Ödeme Aşaması State'leri
  const [showPayment, setShowPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [orderId, setOrderId] = useState(null);
  
  // Kart State'leri
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('tek_cekim');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Kupon State'leri
  const [coupons, setCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Sepetteki ürünler için şirket kuponlarını çek
  useEffect(() => {
    if (showPayment && cart.length > 0) {
      const fetchCoupons = async () => {
        setCouponLoading(true);
        try {
          const ids = cart.map(item => item.urun_id);
          const res = await budgetApi.sepetKuponlari(ids);
          setCoupons(res.kuponlar || []);
        } catch (err) {
          console.error("Kupon yüklenirken hata:", err);
        } finally {
          setCouponLoading(false);
        }
      };
      fetchCoupons();
    } else {
      setSelectedCoupon(null);
    }
  }, [showPayment, cart]);

  const handleUcuzMuadilBul = async () => {
    if (cart.length === 0) {
      toast.error('Sepetiniz boş.');
      return;
    }
    setMuadilLoading(true);
    let degisenSayisi = 0;
    let yeniSepet = [...cart];
    
    try {
      for (let i = 0; i < yeniSepet.length; i++) {
        const urun = yeniSepet[i];
        try {
          const muadil = await productApi.muadilBul(urun.urun_id);
          if (muadil && muadil.fiyat < urun.fiyat) {
            const index = yeniSepet.findIndex(item => item.urun_id === urun.urun_id);
            if (index !== -1) {
              yeniSepet[index] = {
                urun_id: muadil.id,
                ad: muadil.ad,
                fiyat: muadil.fiyat,
                adet: urun.adet,
                kategori: muadil.kategori,
                marka: muadil.marka,
                site: muadil.site,
                resim_url: muadil.resim_url,
              };
              degisenSayisi++;
              toast.success(`${urun.ad} ürünü ${muadil.ad} ile değiştirildi! (Tasarruf: ₺${((urun.fiyat - muadil.fiyat) * urun.adet).toLocaleString('tr-TR')})`, { duration: 4000 });
            }
          }
        } catch (err) {
          console.error(`Muadil arama hatası (${urun.ad}):`, err);
        }
      }
      
      if (degisenSayisi > 0) {
        // Merge duplicates
        const birlesikSepet = [];
        yeniSepet.forEach(item => {
          const mevcut = birlesikSepet.find(b => b.urun_id === item.urun_id);
          if (mevcut) {
            mevcut.adet += item.adet;
          } else {
            birlesikSepet.push(item);
          }
        });
        
        useStore.setState({ cart: birlesikSepet });
        toast.success(`Sepetinizdeki ${degisenSayisi} ürün daha uygun fiyatlı muadiliyle değiştirildi! 🎉`);
        
        // Recalculate AI analysis automatically
        try {
          const r = await aiApi.sepetAnaliz({ mesaj: '', butce: budget, sepet: birlesikSepet });
          setAnaliz(r);
        } catch (e) {
          console.error("Yeniden analiz hatası:", e);
        }
      } else {
        toast.error("Sepetinizdeki ürünler için daha ucuz bir muadil bulunamadı.");
      }
    } catch (e) {
      toast.error("Muadil bulma işlemi sırasında bir hata oluştu.");
    } finally {
      setMuadilLoading(false);
    }
  };

  const sirketMi = kullanici?.tip === 'sirket';

  useEffect(() => {
    if (!token || !kullanici) {
      toast.error('Sepete erişmek için giriş yapmalısınız.');
      navigate('/giris');
    } else if (sirketMi) {
      toast.error('Şirket hesapları sepet kullanamaz.');
      navigate('/profil');
    }
  }, [token, kullanici, sirketMi, navigate]);

  const total = cartTotal();
  const discountedTotal = selectedCoupon 
    ? total * (1 - selectedCoupon.indirim_yuzde / 100) 
    : total;
    
  const bpct  = budget ? Math.min((total / budget.kullanilabilir_butce) * 100, 100) : 0;

  const handleAnaliz = async () => {
    if (!token) { toast.error('Önce giriş yapın.'); return; }
    if (cart.length === 0) { toast.error('Sepet boş.'); return; }
    setLoading(true);
    try {
      const r = await aiApi.sepetAnaliz({ mesaj: '', butce: budget, sepet: cart });
      setAnaliz(r);
    } catch { toast.error('Analiz yapılamadı.'); }
    finally { setLoading(false); }
  };

  // Ödeme/Checkout İşlemi
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Önce giriş yapın.');
      return;
    }
    if (cart.length === 0) {
      toast.error('Sepetiniz boş.');
      return;
    }
    if (cardNumber.length < 16) {
      toast.error('Lütfen geçerli bir kart numarası girin.');
      return;
    }
    if (cardExpiry.length < 5) {
      toast.error('Lütfen geçerli bir son kullanma tarihi girin.');
      return;
    }
    if (cardCvv.length < 3) {
      toast.error('Lütfen geçerli bir CVV girin.');
      return;
    }

    setPaymentLoading(true);
    try {
      const urunlerPayload = cart.map(item => ({
        urun_id: item.urun_id,
        adet: item.adet,
        birim_fiyat: item.fiyat
      }));

      // Siparişi Backend'de oluştur
      const result = await budgetApi.siparisTan({
        urunler: urunlerPayload,
        kupon_kodu: selectedCoupon ? selectedCoupon.kod : null
      });
      setOrderId(result.siparis_id);
      
      // Bütçeyi yenile ve store'da güncelle
      try {
        const updatedBudget = await budgetApi.getir();
        setBudget(updatedBudget);
      } catch (err) {
        console.error("Bütçe yenilenirken hata:", err);
      }

      toast.success('Ödemeniz başarıyla tamamlandı! 🛒🎉');
      setPaymentSuccess(true);
      clearCart();
    } catch (err) {
      console.error("Ödeme hatası:", err);
      toast.error(err.response?.data?.detail || 'Ödeme gerçekleştirilemedi.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Kart Flip/Perspektif Inline-Stilleri (Çapraz tarayıcı kararlılığı için)
  const perspectiveStyle = {
    perspective: '1000px',
  };
  const preserve3dStyle = {
    transformStyle: 'preserve-3d',
  };
  const backfaceHiddenStyle = {
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  if (cart.length === 0 && !paymentSuccess) return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-16 text-center">
      <div className="glass inline-block p-12 rounded-3xl">
        <ShoppingCart size={56} className="mx-auto mb-4 text-gray-600"/>
        <h2 className="text-2xl font-bold mb-2 text-gray-300">Sepetin boş</h2>
        <p className="text-gray-500 mb-6">Ürünleri keşfet ve sepete ekle!</p>
        <Link to="/urunler" className="btn-primary inline-flex items-center gap-2">
          Ürünlere Git <ArrowRight size={18}/>
        </Link>
      </div>
    </div>
  );

  // BAŞARILI ÖDEME SAYFASI
  if (paymentSuccess) {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-4 text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 10 }}
          className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-glow shadow-emerald-500/20"
        >
          <CheckCircle size={48} className="animate-pulse" />
        </motion.div>
        
        <div className="space-y-2">
          <h2 className="text-3xl font-bold font-display text-gradient-brand">Ödeme Başarılı! 🎉</h2>
          <p className="text-gray-400">Siparişiniz alındı ve bütçeniz başarıyla güncellendi.</p>
        </div>

        <div className="glass p-6 rounded-2xl text-left space-y-3 text-sm border border-emerald-500/10">
          <div className="flex justify-between text-gray-500">
            <span>Sipariş Numarası</span>
            <span className="font-bold text-white">#{orderId}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Ödeme Taksit Seçeneği</span>
            <span className="font-semibold text-gray-300">
              {selectedPlan === 'tek_cekim' ? 'Tek Çekim' : selectedPlan.includes('Taksit') ? selectedPlan : 'Taksitli Ödeme'}
            </span>
          </div>
          <div className="flex justify-between text-gray-500 border-t border-white/5 pt-3">
            <span>Toplam Tutar</span>
            <span className="font-bold text-brand-400">₺{total?.toLocaleString('tr-TR')}</span>
          </div>
        </div>

        <div className="pt-4 flex gap-4">
          <button
            onClick={() => {
              setPaymentSuccess(false);
              setShowPayment(false);
              navigate('/');
            }}
            className="btn-secondary flex-1 py-3 text-sm"
          >
            Ana Sayfa
          </button>
          <button
            onClick={() => {
              setPaymentSuccess(false);
              setShowPayment(false);
              navigate('/urunler');
            }}
            className="btn-primary flex-1 py-3 text-sm"
          >
            Keşfe Devam Et
          </button>
        </div>
      </div>
    );
  }

  // ÖDEME SAYFASI GÖRÜNÜMÜ
  if (showPayment) {
    return (
      <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8">
        <button 
          onClick={() => setShowPayment(false)} 
          className="btn-ghost flex items-center gap-2 mb-6 text-sm py-2 px-3 hover:text-white"
        >
          <ArrowLeft size={16} /> Sepete Geri Dön
        </button>

        <h1 className="text-3xl font-bold font-display mb-6 flex items-center gap-3">
          <Wallet size={28} className="text-brand-400"/> Güvenli Ödeme
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sol Kolon: Kart ve Plan Seçimi */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* İnteraktif Kredi Kartı Görseli */}
            <div 
              style={perspectiveStyle} 
              className="w-full max-w-sm mx-auto h-48 cursor-pointer relative"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <motion.div
                style={preserve3dStyle}
                className="w-full h-full relative"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 80, damping: 15 }}
              >
                {/* Kart Ön Yüzü */}
                <div 
                  style={backfaceHiddenStyle}
                  className="absolute inset-0 w-full h-full rounded-2xl p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-white/10 text-white flex flex-col justify-between shadow-2xl"
                >
                  <div className="flex justify-between items-center">
                    {/* Altın Çip */}
                    <div className="w-12 h-9 bg-yellow-600/30 rounded-lg border border-yellow-500/20 relative overflow-hidden">
                      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-yellow-500/30" />
                      <div className="absolute inset-y-0 left-1/2 w-[1px] bg-yellow-500/30" />
                    </div>
                    {/* Kart Tipi Logo */}
                    <div className="text-right text-xs font-bold tracking-widest text-white/50">
                      {cardNumber.startsWith('4') ? 'VISA' : cardNumber.startsWith('5') ? 'MASTERCARD' : 'CÜZDAN'}
                    </div>
                  </div>
                  
                  {/* Kart Numarası */}
                  <div className="text-xl font-mono tracking-widest text-center py-2 text-white/90">
                    {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                  </div>
                  
                  <div className="flex justify-between items-end text-xs">
                    <div>
                      <div className="text-white/40 text-[9px] uppercase tracking-wider">Kart Sahibi</div>
                      <div className="font-mono tracking-wide truncate max-w-[170px] uppercase text-white/80">
                        {cardName || 'KART SAHİBİ'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white/40 text-[9px] uppercase tracking-wider">Son Kul.</div>
                      <div className="font-mono text-white/80">{cardExpiry || 'AA/YY'}</div>
                    </div>
                  </div>
                </div>

                {/* Kart Arka Yüzü */}
                <div 
                  style={{ ...backfaceHiddenStyle, transform: 'rotateY(180deg)' }}
                  className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-white/10 text-white flex flex-col justify-between shadow-2xl overflow-hidden"
                >
                  <div className="w-full h-10 bg-black/80 mt-4" />
                  
                  <div className="px-6 py-2 flex flex-col items-end">
                    <div className="text-white/40 text-[9px] uppercase tracking-wider mr-2">CVV</div>
                    <div className="w-full bg-white text-black font-mono font-bold text-right py-1 px-3 rounded text-sm italic tracking-widest mt-1">
                      {cardCvv || '•••'}
                    </div>
                  </div>
                  
                  <div className="p-4 text-[8px] text-white/30 text-center tracking-wider leading-relaxed border-t border-white/5">
                    Bu kart CüzdanDostu KVKK güvencesiyle 256-bit uçtan uca şifreli olarak simüle edilmiştir.
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Kart Bilgileri Giriş Formu */}
            <form onSubmit={handleCheckout} className="glass p-6 rounded-3xl space-y-4">
              <h3 className="font-bold text-lg mb-2">Kart Bilgileri</h3>
              
              <div className="space-y-4">
                {/* Kart Sahibinin Adı */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold">Kart Üzerindeki İsim</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Ad Soyad"
                      className="input-field pl-10 uppercase"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Kart Numarası */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold">Kart Numarası</label>
                  <div className="relative">
                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      maxLength="19"
                      placeholder="0000 0000 0000 0000"
                      className="input-field pl-10"
                      value={cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setCardNumber(val.slice(0, 16));
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Son Kullanma ve CVV */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-semibold">Son Kullanma Tarihi</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="text"
                        placeholder="AA/YY"
                        maxLength="5"
                        className="input-field pl-10"
                        value={cardExpiry}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) {
                            val = val.slice(0, 2) + '/' + val.slice(2, 4);
                          }
                          setCardExpiry(val);
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 font-semibold">Güvenlik Kodu (CVV)</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input
                        type="password"
                        maxLength="3"
                        placeholder="•••"
                        className="input-field pl-10"
                        value={cardCvv}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setCardCvv(val.slice(0, 3));
                        }}
                        onFocus={() => setIsFlipped(true)}
                        onBlur={() => setIsFlipped(false)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* KVKK / SSL Bilgi */}
              <div className="bg-dark-800/40 p-4 rounded-2xl flex gap-3 text-xs text-gray-500 mt-6 leading-relaxed">
                <Lock size={16} className="text-brand-400 flex-shrink-0 mt-0.5" />
                <p>
                  Ödemeniz <strong>256-bit SSL şifreleme</strong> ve <strong>KVKK güvencesiyle</strong> uçtan uca şifreli olarak gerçekleştirilmektedir. Kart ve kişisel verileriniz hiçbir şekilde saklanmaz veya üçüncü taraflarla paylaşılmaz.
                </p>
              </div>

              {/* Ödemeyi Tamamla Butonu */}
              <button
                type="submit"
                disabled={paymentLoading}
                className="btn-gold w-full flex items-center justify-center gap-2 mt-6 py-3 px-4 font-bold text-lg"
              >
                {paymentLoading ? (
                  <div className="w-6 h-6 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={20} />
                    <span>₺{discountedTotal?.toLocaleString('tr-TR')} Ödemeyi Tamamla</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sağ Kolon: Ödeme Seçenekleri (Taksit vs) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-strong p-6 rounded-3xl space-y-4">
              <h3 className="font-bold text-lg">Ödeme Yöntemi / Planı</h3>
              
              <div className="space-y-3">
                {/* Tek Çekim */}
                <div 
                  onClick={() => setSelectedPlan('tek_cekim')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-center
                    ${selectedPlan === 'tek_cekim' 
                      ? 'bg-brand-500/10 border-brand-400 shadow-glow shadow-brand-500/5' 
                      : 'bg-dark-800/40 border-white/5 hover:border-white/10'}`}
                >
                  <div>
                    <p className="font-semibold text-sm">Tek Çekim (Kredi Kartı)</p>
                    <p className="text-xs text-gray-500 mt-0.5">Faizsiz tek seferde ödeme</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">₺{discountedTotal?.toLocaleString('tr-TR')}</p>
                  </div>
                </div>

                {/* AI veya Default Taksit Planları */}
                {analiz && analiz.odeme_alternatifleri?.length > 0 ? (
                  analiz.odeme_alternatifleri.slice(0, 3).map((plan, idx) => {
                    const planAy = plan.ay_sayisi || 3;
                    const planFaiz = plan.faiz_orani || 0;
                    const planFaizli = discountedTotal * (1 + planFaiz / 100 * planAy);
                    const planTaksit = planFaizli / planAy;
                    
                    return (
                      <div 
                        key={idx}
                        onClick={() => setSelectedPlan(plan.plan_adi)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-center
                          ${selectedPlan === plan.plan_adi
                            ? 'bg-brand-500/10 border-brand-400 shadow-glow shadow-brand-500/5' 
                            : 'bg-dark-800/40 border-white/5 hover:border-white/10'}`}
                      >
                        <div>
                          <p className="font-semibold text-sm">{plan.plan_adi}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Bütçenize göre optimize edilmiş ödeme planı</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-brand-400">₺{planTaksit?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}/ay</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">Toplam: ₺{planFaizli?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Bütçe Analizi Yapılmamışsa Default Taksit Seçenekleri
                  <>
                    <div 
                      onClick={() => setSelectedPlan('3_taksit')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-center
                        ${selectedPlan === '3_taksit' 
                          ? 'bg-brand-500/10 border-brand-400 shadow-glow shadow-brand-500/5' 
                          : 'bg-dark-800/40 border-white/5 hover:border-white/10'}`}
                    >
                      <div>
                        <p className="font-semibold text-sm">3 Taksit (Faizsiz)</p>
                        <p className="text-xs text-gray-500 mt-0.5">CüzdanDostu Özel Kampanyası</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-400">₺{(discountedTotal / 3)?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}/ay</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">Toplam: ₺{discountedTotal?.toLocaleString('tr-TR')}</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setSelectedPlan('6_taksit')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-center
                        ${selectedPlan === '6_taksit' 
                          ? 'bg-brand-500/10 border-brand-400 shadow-glow shadow-brand-500/5' 
                          : 'bg-dark-800/40 border-white/5 hover:border-white/10'}`}
                    >
                      <div>
                        <p className="font-semibold text-sm">6 Taksit</p>
                        <p className="text-xs text-gray-500 mt-0.5">%1.5 Vade Farkı</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-400">₺{((discountedTotal * 1.09) / 6)?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}/ay</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">Toplam: ₺{(discountedTotal * 1.09)?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* İndirim Kuponları Bölümü */}
            <div className="glass p-5 rounded-3xl space-y-4 border border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-yellow-400" />
                <h4 className="font-bold text-white">Geçerli İndirim Kuponları</h4>
              </div>
              
              {couponLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : coupons.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {coupons.map((coupon) => {
                    const isSelected = selectedCoupon?.kod === coupon.kod;
                    return (
                      <div
                        key={coupon.kod}
                        onClick={() => setSelectedCoupon(isSelected ? null : coupon)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-center text-xs
                          ${isSelected 
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-glow shadow-emerald-500/5' 
                            : 'bg-dark-800/40 border-white/5 hover:border-white/10'}`}
                      >
                        <div className="space-y-1">
                          <span className="font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-wider text-[10px]">
                            {coupon.kod}
                          </span>
                          <p className="text-gray-400 font-semibold mt-1">
                            {coupon.sirket_adi} Mağazası
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-400 text-sm">
                            %{coupon.indirim_yuzde} İndirim
                          </p>
                          <p className="text-[10px] text-gray-500">
                            Geçerlilik: {coupon.gecerlilik}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Sepetinizdeki ürünler için aktif bir şirket indirim kuponu bulunmamaktadır.
                </p>
              )}
            </div>

            {/* Sipariş Özet Kartı */}
            <div className="glass p-5 rounded-3xl space-y-3 text-sm border border-white/5">
              <h4 className="font-bold text-white mb-1">Sipariş Detayı</h4>
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.urun_id} className="flex justify-between text-gray-400">
                    <span className="line-clamp-1 flex-1 mr-2">{item.ad} x{item.adet}</span>
                    <span>₺{(item.fiyat * item.adet)?.toLocaleString('tr-TR')}</span>
                  </div>
                ))}
              </div>
              
              {selectedCoupon && (
                <div className="border-t border-white/5 pt-2 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Orijinal Toplam</span>
                    <span>₺{total?.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Kupon İndirimi ({selectedCoupon.kod})</span>
                    <span>-₺{(total * selectedCoupon.indirim_yuzde / 100)?.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
              
              <div className="border-t border-white/5 pt-3 flex justify-between font-bold text-base">
                <span>Ödenecek Tutar</span>
                <span className="text-brand-400">₺{discountedTotal?.toLocaleString('tr-TR')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STANDART SEPET GÖRÜNÜMÜ
  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 xl:px-16 py-8">
      <h1 className="text-3xl font-bold font-display mb-6 flex items-center gap-3">
        <ShoppingCart size={28} className="text-brand-400"/> Sepetim
        <span className="badge-green">{cart.length} ürün</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ürün listesi */}
        <div className="lg:col-span-2 space-y-3">
          <AnimatePresence>
            {cart.map(urun => (
              <motion.div key={urun.urun_id}
                initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}}
                exit={{opacity:0,x:20,height:0}} layout
                className="glass p-4 rounded-2xl flex items-center gap-4">
                <img src={urun.resim_url||'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                  alt={urun.ad} className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  onError={e=>e.target.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-100 line-clamp-1">{urun.ad}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{urun.marka} · {urun.site}</p>
                  <p className="text-brand-400 font-bold mt-1">₺{urun.fiyat?.toLocaleString('tr-TR')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>updateCartQty(urun.urun_id, urun.adet-1)}
                    className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-600 transition-colors">
                    <Minus size={14}/>
                  </button>
                  <span className="w-8 text-center font-bold">{urun.adet}</span>
                  <button onClick={()=>updateCartQty(urun.urun_id, urun.adet+1)}
                    className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-600 transition-colors">
                    <Plus size={14}/>
                  </button>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-white">₺{(urun.fiyat*urun.adet)?.toLocaleString('tr-TR')}</p>
                  <button onClick={()=>removeFromCart(urun.urun_id)} className="btn-danger mt-1 py-1 px-2 text-xs">
                    <Trash2 size={12}/>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button onClick={clearCart} className="btn-danger w-full mt-2 flex items-center justify-center gap-2">
            <Trash2 size={16}/> Sepeti Temizle
          </button>
        </div>

        {/* Özet + Analiz */}
        <div className="space-y-4">
          <div className="glass-strong p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-lg">Sipariş Özeti</h3>
            <div className="space-y-2 text-sm">
              {cart.map(u => (
                <div key={u.urun_id} className="flex justify-between text-gray-400">
                  <span className="line-clamp-1 flex-1 mr-2">{u.ad} x{u.adet}</span>
                  <span>₺{(u.fiyat*u.adet)?.toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/8 pt-3 flex justify-between font-bold text-lg">
              <span>Toplam</span>
              <span className="text-gradient-brand">₺{total?.toLocaleString('tr-TR')}</span>
            </div>

            {/* Bütçe progress */}
            {budget && (
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Bütçe kullanımı</span>
                  <span className={bpct>100?'text-red-400':bpct>80?'text-yellow-400':'text-brand-400'}>
                    %{bpct.toFixed(0)}
                  </span>
                </div>
                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${bpct>100?'bg-red-500':bpct>80?'bg-yellow-500':'bg-brand-gradient'}`}
                    initial={{width:0}} animate={{width:`${Math.min(bpct,100)}%`}} transition={{duration:0.8}}/>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Kullanılabilir: ₺{budget.kullanilabilir_butce?.toLocaleString('tr-TR')}
                </p>
              </div>
            )}

            {/* Ödemeye Geç Butonu */}
            <button 
              onClick={() => setShowPayment(true)}
              className="btn-primary w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-accent-sky hover:from-brand-600 hover:to-accent-sky-dark text-white font-bold py-3 px-4 rounded-xl shadow-glow transition-all duration-300 transform hover:scale-[1.02]"
            >
              <Wallet size={18}/> 
              <span>Ödemeye Geç</span>
            </button>

            {/* Sepet Analiz Ajanı Butonu */}
            <button onClick={handleAnaliz} disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2 border border-white/5 bg-dark-800/40 hover:bg-dark-700/60">
              {loading
                ? <div className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>
                : <><Zap size={18}/> Bütçeye Göre Sepetimi Ayarla</>}
            </button>
          </div>

          {/* AI Analiz sonucu */}
          <AnimatePresence>
            {analiz && (
              <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
                className="glass-strong p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className="text-yellow-400"/>
                  <h4 className="font-bold">AI Analiz</h4>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full
                    ${analiz.risk_seviyesi==='dusuk'?'badge-green':analiz.risk_seviyesi==='yuksek'?'badge-red':'badge-yellow'}`}>
                    {analiz.risk_seviyesi==='dusuk'?'Düşük Risk':analiz.risk_seviyesi==='yuksek'?'Yüksek Risk':'Orta Risk'}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{analiz.yanit}</p>
                {analiz.onerileri?.length > 0 && (
                  <ul className="space-y-1">
                    {analiz.onerileri.map((o,i) => <li key={i} className="text-xs text-gray-400 flex gap-2"><Star size={12} className="text-yellow-400 flex-shrink-0 mt-0.5"/>{o}</li>)}
                  </ul>
                )}
                {analiz.odeme_alternatifleri?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2">Bütçeye göre sepetimi nasıl ödeme yapacağım</p>
                    <div className="space-y-2">
                      {analiz.odeme_alternatifleri.slice(0,3).map((p,i) => (
                        <div key={i} className="bg-dark-700/50 rounded-xl p-3 flex justify-between text-xs">
                          <span className="text-gray-300">{p.plan_adi}</span>
                          <span className="text-brand-400 font-bold">₺{p.aylik_taksit?.toLocaleString('tr-TR')}/ay</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Ucuz Muadil Bul Butonu */}
                    <button
                      onClick={handleUcuzMuadilBul}
                      disabled={muadilLoading}
                      className="btn-gold w-full flex items-center justify-center gap-2 mt-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-xl shadow-glow transition-all duration-300 transform hover:scale-[1.02]"
                    >
                      {muadilLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Ucuz Muadil Bul</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
