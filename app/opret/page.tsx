'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const nameTrimmed = name.trim();
  const emailTrimmed = email.trim();

  const isNameValid = nameTrimmed.length > 0;
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed),
    [emailTrimmed]
  );

  const isPasswordLongEnough = password.length >= 8;
  const hasNumber = /\d/.test(password); 
  const isPasswordStrong = isPasswordLongEnough && hasNumber;
  const passwordsMatch = confirm === password && confirm.length > 0;

  const canSubmit =
    isNameValid && isEmailValid && isPasswordStrong && passwordsMatch && !loading;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/login`;

      const { error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: nameTrimmed },
        },
      });

      if (error) throw error;
      setSuccess(true);
    } catch (e: any) {
      alert(e?.message || 'Noget gik galt. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#869FB9]">
      <SiteHeader />

      <main className="flex-1 content-shell flex items-center justify-center py-12">
        <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 md:p-12 relative border border-gray-100">
          
          {/* Tilbage knap */}
          {!success && (
            <button
              onClick={() => router.push('/')}
              className="absolute top-10 left-10 text-gray-500 hover:text-black transition-colors"
              type="button"
            >
              <i className="fa-solid fa-arrow-left text-xl"></i>
            </button>
          )}

          {success ? (
            /* --- SUCCES SCREEN --- */
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                <i className="fa-solid fa-envelope-open-text"></i>
              </div>
              <h1 className="text-2xl font-black text-[#131921] mb-4">Tjek din indbakke!</h1>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Vi har sendt en bekræftelsesmail til:<br />
                <span className="font-bold text-[#131921]">{emailTrimmed}</span>
              </p>
              <Link href="/login" className="block w-full bg-[#131921] text-white font-bold py-4 rounded-2xl text-center shadow-lg hover:bg-black transition-all uppercase tracking-widest text-sm">
                Gå til Log ind
              </Link>
            </div>
          ) : (
            /* --- FORMULAR --- */
            <div className="flex flex-col">
              <h1 className="text-4xl font-black text-[#131921] mb-10 text-center">
                Opret bruger
              </h1>

              <form onSubmit={handleSignup} className="w-full flex flex-col gap-6">
                
                {/* NAVN */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-gray-600 uppercase ml-5 tracking-wider">Navn</label>
                  <input
                    type="text"
                    placeholder="Dit navn"
                    className="w-full h-14 rounded-2xl px-6 bg-gray-50 border border-gray-200 text-[#131921] font-medium outline-none focus:bg-white focus:border-[#131921] transition-all placeholder:text-gray-400"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* EMAIL */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-gray-600 uppercase ml-5 tracking-wider">Email</label>
                  <input
                    type="email"
                    placeholder="din@email.dk"
                    className="w-full h-14 rounded-2xl px-6 bg-gray-50 border border-gray-200 text-[#131921] font-medium outline-none focus:bg-white focus:border-[#131921] transition-all placeholder:text-gray-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* SIKKERHEDSKRAV (Samme layout som app) */}
                <div className="ml-5 mt-1">
                  <p className="text-[14px] font-black text-[#131921] mb-1.5">Sikkerhedskrav til password:</p>
                  <ul className="text-[13px] text-gray-600 font-medium space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">•</span> Minimum 8 karakterer
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">•</span> Skal indeholde mindst ét tal
                    </li>
                  </ul>
                </div>

                {/* PASSWORD */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Vælg password"
                      className="w-full h-14 rounded-2xl px-6 pr-14 bg-gray-50 border border-gray-200 text-[#131921] font-medium outline-none focus:bg-white focus:border-[#131921] transition-all placeholder:text-gray-400"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#131921] transition-colors"
                    >
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-lg`}></i>
                    </button>
                  </div>

                  {/* Password Styrke Indikator */}
                  {password.length > 0 && (
                    <div className="px-5 mt-1 flex items-center gap-3">
                      <div className={`h-1.5 w-10 rounded-full transition-all ${isPasswordStrong ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`text-[12px] font-bold ${isPasswordStrong ? 'text-green-600' : 'text-red-600'}`}>
                        {!isPasswordLongEnough 
                          ? `Mangler ${8 - password.length} tegn...` 
                          : !hasNumber 
                            ? 'Husk mindst ét tal' 
                            : 'Password godkendt'}
                      </span>
                    </div>
                  )}
                </div>

                {/* GENTAG PASSWORD */}
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Bekræft password"
                      className="w-full h-14 rounded-2xl px-6 pr-14 bg-gray-50 border border-gray-200 text-[#131921] font-medium outline-none focus:bg-white focus:border-[#131921] transition-all placeholder:text-gray-400"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#131921] transition-colors"
                    >
                      <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'} text-lg`}></i>
                    </button>
                  </div>
                  {confirm.length > 0 && !passwordsMatch && (
                    <p className="text-red-600 text-[12px] font-bold px-5 mt-1 flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation"></i> Passwords matcher ikke.
                    </p>
                  )}
                </div>

                {/* OPRET KNAP */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full h-16 rounded-2xl mt-6 font-black text-sm tracking-[0.2em] transition-all flex items-center justify-center uppercase shadow-lg
                    ${canSubmit
                      ? 'bg-[#131921] text-white hover:bg-black hover:scale-[1.01]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Opret bruger'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
