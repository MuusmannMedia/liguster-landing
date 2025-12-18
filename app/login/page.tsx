'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient'; 
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Link from 'next/link';

export default function LoginScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg("Udfyld både email og password.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Hvis succes, send brugeren til opslag-siden (eller forsiden)
      router.push('/opslag');
      
    } catch (error: any) {
      // Oversæt typiske fejlbeskeder til dansk
      if (error.message.includes("Invalid login credentials")) {
        setErrorMsg("Forkert email eller adgangskode.");
      } else {
        setErrorMsg(error.message || "Login fejlede. Prøv igen.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center p-4 py-20">
        <div className="bg-white w-full max-w-md rounded-[30px] shadow-2xl p-8 md:p-10 relative">
          
          {/* Tilbage knap */}
          <button 
            onClick={() => router.push('/')} 
            className="absolute top-6 left-6 text-gray-400 hover:text-black transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xl"></i>
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-black text-[#131921] mb-2 mt-4">Log ind</h1>
            <p className="text-gray-500 text-sm text-center mb-8">
              Velkommen tilbage
            </p>

            {errorMsg && (
              <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 text-center border border-red-100 flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                {errorMsg}
              </div>
            )}

            <form onSubmit={onLogin} className="w-full flex flex-col gap-4">
              
              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="din@email.dk"
                  className="w-full h-12 rounded-full px-6 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">Adgangskode</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Adgangskode"
                    className="w-full h-12 rounded-full px-6 pr-12 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              {/* Glemt kodeord link */}
              <div className="text-right px-2">
                <Link href="/glemt-kodeord" className="text-xs text-gray-500 hover:text-[#131921] hover:underline font-medium">
                  Glemt kodeord?
                </Link>
              </div>

              {/* Login Knap */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full mt-2 font-bold text-base tracking-wide transition-all shadow-md flex items-center justify-center gap-2 bg-[#131921] text-white hover:bg-black hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Logger ind...</>
                ) : (
                  'LOG IND'
                )}
              </button>
            </form>

            {/* Opret Link */}
            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm">
                Har du ikke en konto?{' '}
                <Link href="/opret" className="text-[#131921] font-bold hover:underline">
                  Opret her
                </Link>
              </p>
            </div>

            {/* Footer Links (Privacy etc) */}
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