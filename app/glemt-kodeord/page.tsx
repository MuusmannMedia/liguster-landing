'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Link from 'next/link';

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Til øje-ikonet

  const normalizedEmail = email.trim().toLowerCase();

  // Håndter "Tilbage" knappen i toppen
  const goBack = () => {
    setErrorMsg('');
    if (step === 'code') {
      setStep('email');
      setCode('');
      return;
    }
    if (step === 'password') {
      setStep('code');
      setNewPassword('');
      setConfirmPassword('');
      return;
    }
    router.back(); // Eller router.push('/login')
  };

  // --- LOGIK (Samme som før) ---

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail) return setErrorMsg('Indtast din e-mailadresse.');
    if (loading) return;

    try {
      setLoading(true);
      setErrorMsg('');
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setStep('code');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Der opstod en fejl. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length < 6) return setErrorMsg('Indtast den 6-cifrede kode.');
    if (loading) return;

    try {
      setLoading(true);
      setErrorMsg('');
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: trimmedCode,
        type: 'email',
      });
      if (error) throw error;
      setStep('password');
    } catch (e: any) {
      setErrorMsg('Koden kunne ikke godkendes. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return setErrorMsg('Password skal være min. 8 tegn.');
    if (newPassword !== confirmPassword) return setErrorMsg('De to passwords er ikke ens.');
    if (loading) return;

    try {
      setLoading(true);
      setErrorMsg('');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      // Succes!
      router.replace('/opslag');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Kunne ikke opdatere password.');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER CONTENT BASERET PÅ TRIN ---
  const renderStepContent = () => {
    switch (step) {
      case 'email':
        return (
          <>
            <p className="text-gray-500 text-sm text-center mb-8">
              Indtast din e-mailadresse, så sender vi en 6-cifret kode til dig.
            </p>
            <form onSubmit={handleSendCode} className="w-full flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="din@email.dk"
                  className="w-full h-12 rounded-full px-6 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full mt-2 font-bold text-base tracking-wide transition-all shadow-md flex items-center justify-center gap-2 bg-[#131921] text-white hover:bg-black hover:scale-[1.02] disabled:opacity-70"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'SEND KODE'}
              </button>
            </form>
          </>
        );

      case 'code':
        return (
          <>
            <p className="text-gray-500 text-sm text-center mb-8">
              Vi har sendt en kode til <span className="font-bold text-black">{normalizedEmail}</span>
            </p>
            <form onSubmit={handleVerifyCode} className="w-full flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">6-cifret kode</label>
                <input
                  type="text"
                  placeholder="123456"
                  className="w-full h-12 rounded-full px-6 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] text-center tracking-widest font-bold text-lg transition-colors"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full mt-2 font-bold text-base tracking-wide transition-all shadow-md flex items-center justify-center gap-2 bg-[#131921] text-white hover:bg-black hover:scale-[1.02] disabled:opacity-70"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'BEKRÆFT KODE'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button onClick={() => setStep('email')} className="text-sm text-gray-500 hover:text-[#131921] hover:underline">
                Ændr e-mailadresse
              </button>
            </div>
          </>
        );

      case 'password':
        return (
          <>
            <p className="text-gray-500 text-sm text-center mb-8">
              Du er nu verificeret. Vælg et nyt kodeord.
            </p>
            <form onSubmit={handleSaveNewPassword} className="w-full flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">Nyt password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 tegn"
                    className="w-full h-12 rounded-full px-6 pr-12 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-2"
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">Gentag password</label>
                <input
                  type="password"
                  placeholder="Gentag password"
                  className="w-full h-12 rounded-full px-6 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full mt-2 font-bold text-base tracking-wide transition-all shadow-md flex items-center justify-center gap-2 bg-[#131921] text-white hover:bg-black hover:scale-[1.02] disabled:opacity-70"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'GEM NYT PASSWORD'}
              </button>
            </form>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center p-4 py-20">
        <div className="bg-white w-full max-w-md rounded-[30px] shadow-2xl p-8 md:p-10 relative">
          
          {/* Tilbage knap */}
          <button 
            onClick={goBack} 
            className="absolute top-6 left-6 text-gray-400 hover:text-black transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xl"></i>
          </button>

          <div className="flex flex-col items-center">
            {/* Titel ændres baseret på step */}
            <h1 className="text-3xl font-black text-[#131921] mb-2 mt-4">
              {step === 'email' ? 'Glemt kodeord' : step === 'code' ? 'Indtast kode' : 'Nyt kodeord'}
            </h1>

            {/* Fejlbesked boks */}
            {errorMsg && (
              <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center border border-red-100 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                {errorMsg}
              </div>
            )}

            {/* Dynamisk indhold */}
            {renderStepContent()}

            {/* Footer Links (Privacy etc - for at matche login siden) */}
            <div className="mt-8 flex gap-4 text-xs text-gray-400">
              <Link href="/privacy" className="hover:text-gray-600 transition-colors">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/disclaimer" className="hover:text-gray-600 transition-colors">
                Ansvarsfraskrivelse
              </Link>
            </div>

          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}