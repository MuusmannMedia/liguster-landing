'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();

  // State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  // Trim
  const nameTrimmed = name.trim();
  const emailTrimmed = email.trim();

  // Validering
  const isNameValid = nameTrimmed.length > 0;

  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed),
    [emailTrimmed]
  );

  const isPasswordStrong = password.length >= 8;
  const passwordsMatch = confirm === password;

  const canSubmit =
    isNameValid && isEmailValid && isPasswordStrong && passwordsMatch && !loading;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isNameValid) return alert('Indtast dit navn.');
    if (!isEmailValid) return alert('Indtast en gyldig email.');
    if (!isPasswordStrong) return alert('Password skal være mindst 8 tegn.');
    if (!passwordsMatch) return alert('Passwords er ikke ens.');

    try {
      setLoading(true);

      const redirectUrl = `${window.location.origin}/login`;

      // 1) Signup + metadata (brug samme key som appen)
      const { data, error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: nameTrimmed,
          },
        },
      });

      if (error) throw error;

      // 2) Opret række i public.users (sekundært - trigger er bedre)
      try {
        const userId = data?.user?.id || data?.session?.user?.id;
        const userEmail =
          data?.user?.email || data?.session?.user?.email || emailTrimmed;

        if (userId && userEmail) {
          const { data: existing, error: exErr } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

          if (exErr) {
            console.warn('Kunne ikke tjekke eksisterende user-row:', exErr);
          }

          if (!existing) {
            const { error: insErr } = await supabase.from('users').insert([
              {
                id: userId,
                email: userEmail,
                name: nameTrimmed,
              },
            ]);

            if (insErr) console.warn('Kunne ikke indsætte user-row:', insErr);
          }
        }
      } catch (err) {
        console.warn('Sekundær oprettelse fejl:', err);
      }

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

      <main className="flex-1 flex items-center justify-center p-4 py-20">
        <div className="bg-white w-full max-w-md rounded-[30px] shadow-2xl p-8 md:p-10 relative">
          {/* Tilbage knap */}
          {!success && (
            <button
              onClick={() => router.push('/')}
              className="absolute top-6 left-6 text-gray-400 hover:text-black transition-colors"
              type="button"
            >
              <i className="fa-solid fa-arrow-left text-xl"></i>
            </button>
          )}

          {/* --- SUCCES --- */}
          {success ? (
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-sm">
                <i className="fa-solid fa-envelope-open-text"></i>
              </div>

              <h1 className="text-2xl font-black text-[#131921] mb-4">
                Tjek din indbakke!
              </h1>

              <p className="text-gray-600 mb-6 leading-relaxed">
                Vi har sendt en bekræftelsesmail til:
                <br />
                <span className="font-bold text-[#131921]">{emailTrimmed}</span>
              </p>

              <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 mb-8 border border-blue-100 flex items-start text-left gap-3">
                <i className="fa-solid fa-circle-info mt-0.5 shrink-0"></i>
                <span>
                  Du skal klikke på linket i mailen for at aktivere din konto,
                  før du kan logge ind.
                </span>
              </div>

              <Link
                href="/login"
                className="block w-full bg-[#131921] text-white font-bold py-4 rounded-full shadow-lg hover:bg-gray-900 transition-all text-center"
              >
                Gå til Log ind
              </Link>
            </div>
          ) : (
            /* --- FORMULAR --- */
            <div className="flex flex-col items-center">
              <h1 className="text-3xl font-black text-[#131921] mb-2 mt-4">
                Opret bruger
              </h1>
              <p className="text-gray-500 text-sm text-center mb-8">
                Det tager kun et øjeblik at komme i gang.
              </p>

              <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">
                    Navn
                  </label>
                  <input
                    type="text"
                    placeholder="Dit navn"
                    className="w-full h-12 rounded-full px-6 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                  />
                  {!isNameValid && name.length > 0 && (
                    <p className="text-red-500 text-xs mt-2 px-4 flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation"></i> Navn kan
                      ikke være tomt.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="din@email.dk"
                    className="w-full h-12 rounded-full px-6 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 tegn"
                      className="w-full h-12 rounded-full px-6 pr-12 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-2"
                      disabled={loading}
                    >
                      <i
                        className={`fa-solid ${
                          showPassword ? 'fa-eye-slash' : 'fa-eye'
                        }`}
                      ></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase ml-4 mb-1">
                    Gentag Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Bekræft password"
                      className="w-full h-12 rounded-full px-6 pr-12 bg-gray-50 border border-gray-200 text-black outline-none focus:border-[#131921] transition-colors"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black p-2"
                      disabled={loading}
                    >
                      <i
                        className={`fa-solid ${
                          showConfirm ? 'fa-eye-slash' : 'fa-eye'
                        }`}
                      ></i>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 px-4 mt-2">
                  {!isEmailValid && email.length > 0 && (
                    <p className="text-red-500 text-xs flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation"></i> Ugyldig
                      email.
                    </p>
                  )}
                  {!isPasswordStrong && password.length > 0 && (
                    <p className="text-red-500 text-xs flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation"></i> Password
                      er for kort.
                    </p>
                  )}
                  {!passwordsMatch && confirm.length > 0 && (
                    <p className="text-red-500 text-xs flex items-center gap-1">
                      <i className="fa-solid fa-circle-exclamation"></i> Passwords
                      matcher ikke.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full h-14 rounded-full mt-4 font-bold text-base tracking-wide transition-all shadow-md flex items-center justify-center gap-2
                    ${
                      canSubmit
                        ? 'bg-[#131921] text-white hover:bg-black hover:scale-[1.02]'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Opretter...
                    </>
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