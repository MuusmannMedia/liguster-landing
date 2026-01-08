'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient'; // Sørg for at stien passer til din struktur

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  const goBack = () => {
    if (step === 'code') {
      setStep('email');
      setCode('');
      setErrorMsg('');
      return;
    }
    if (step === 'password') {
      setStep('code');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      return;
    }
    router.back();
  };

  // TRIN 1 – SEND KODE TIL MAIL
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail) {
      setErrorMsg('Indtast din e-mailadresse.');
      return;
    }
    if (loading) return;

    try {
      setLoading(true);
      setErrorMsg('');

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });

      if (error) throw error;

      alert('Vi har sendt en 6-cifret kode til din e-mail. Tjek din indbakke (og evt. spam).');
      setStep('code');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Der opstod en fejl. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  // TRIN 2 – VERIFICÉR KODE
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();

    if (!trimmedCode || trimmedCode.length < 6) {
      setErrorMsg('Indtast den 6-cifrede kode.');
      return;
    }
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

  // TRIN 3 – GEM NYT PASSWORD
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('Dit password skal som minimum være 8 tegn.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('De to passwords skal være ens.');
      return;
    }
    if (loading) return;

    try {
      setLoading(true);
      setErrorMsg('');

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      alert('Dit password er ændret. Du bliver nu sendt videre.');
      router.replace('/opslag');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Kunne ikke opdatere password. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#869FB9] flex flex-col relative">
      
      {/* Tilbage Knap */}
      <button 
        onClick={goBack}
        className="absolute top-6 left-6 text-white w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors z-20"
      >
        <i className="fa-solid fa-chevron-left text-2xl"></i>
      </button>

      {/* Indhold */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col items-center">
          
          {/* TRIN 1: EMAIL */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="flex flex-col items-center w-full">
              <h1 className="text-white text-3xl font-bold mb-2">Glemt kodeord</h1>
              <p className="text-[#E0E7FF] text-center mb-8 px-4 text-sm leading-relaxed">
                Indtast din e-mailadresse, så sender vi en 6-cifret kode, du kan logge ind med.
              </p>

              <input
                type="email"
                placeholder="Din e-mail"
                className="w-full bg-white text-[#131921] px-6 py-4 rounded-full mb-3 outline-none focus:ring-4 focus:ring-blue-300 placeholder-gray-400 font-medium transition-shadow"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#131921] text-white font-bold py-4 rounded-full uppercase tracking-wider hover:bg-gray-900 transition-colors disabled:opacity-70 mt-2"
              >
                {loading ? "Sender..." : "SEND KODE"}
              </button>
            </form>
          )}

          {/* TRIN 2: KODE */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="flex flex-col items-center w-full">
              <h1 className="text-white text-3xl font-bold mb-2">Indtast kode</h1>
              <p className="text-[#E0E7FF] text-center mb-8 px-4 text-sm leading-relaxed">
                Vi har sendt en 6-cifret kode til <br/>
                <span className="font-bold text-white">{normalizedEmail}</span>
              </p>

              <input
                type="text"
                placeholder="6-cifret kode"
                className="w-full bg-white text-[#131921] px-6 py-4 rounded-full mb-3 outline-none focus:ring-4 focus:ring-blue-300 placeholder-gray-400 font-medium text-center tracking-widest text-lg"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                autoFocus
              />

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#131921] text-white font-bold py-4 rounded-full uppercase tracking-wider hover:bg-gray-900 transition-colors disabled:opacity-70 mt-2"
              >
                {loading ? "Tjekker..." : "BEKRÆFT KODE"}
              </button>

              <button 
                type="button"
                onClick={() => setStep('email')}
                className="mt-6 text-[#131921] font-bold text-sm hover:underline"
              >
                Ændr e-mailadresse
              </button>
            </form>
          )}

          {/* TRIN 3: NYT PASSWORD */}
          {step === 'password' && (
            <form onSubmit={handleSaveNewPassword} className="flex flex-col items-center w-full">
              <h1 className="text-white text-3xl font-bold mb-2">Vælg nyt password</h1>
              <p className="text-[#E0E7FF] text-center mb-8 px-4 text-sm leading-relaxed">
                Du er nu logget ind via koden. Vælg et nyt password til din konto.
              </p>

              <input
                type="password"
                placeholder="Nyt password"
                className="w-full bg-white text-[#131921] px-6 py-4 rounded-full mb-3 outline-none focus:ring-4 focus:ring-blue-300 placeholder-gray-400 font-medium"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />

              <input
                type="password"
                placeholder="Gentag nyt password"
                className="w-full bg-white text-[#131921] px-6 py-4 rounded-full mb-3 outline-none focus:ring-4 focus:ring-blue-300 placeholder-gray-400 font-medium mt-3"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#131921] text-white font-bold py-4 rounded-full uppercase tracking-wider hover:bg-gray-900 transition-colors disabled:opacity-70 mt-5"
              >
                {loading ? "Gemmer..." : "GEM NYT PASSWORD"}
              </button>
            </form>
          )}

          {/* FEJLBESKED */}
          {errorMsg && (
            <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative w-full text-center text-sm font-bold animate-in fade-in slide-in-from-bottom-2">
              {errorMsg}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}