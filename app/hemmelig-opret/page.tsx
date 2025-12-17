'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient'; // Tjek stien passer til din struktur

export default function SecretSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validering (samme logik som app)
  const emailTrimmed = email.trim();
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed),
    [emailTrimmed]
  );
  const isPasswordStrong = password.length >= 8;
  const passwordsMatch = confirm === password;
  const canSubmit = isEmailValid && isPasswordStrong && passwordsMatch && !loading;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEmailValid) return alert('Indtast en gyldig email.');
    if (!isPasswordStrong) return alert('Password skal være mindst 8 tegn.');
    if (!passwordsMatch) return alert('Passwords er ikke ens.');

    try {
      setLoading(true);

      // Web redirect URL (finder automatisk nuværende domæne)
      const redirectUrl = `${window.location.origin}/login`;

      const { data, error } = await supabase.auth.signUp({
        email: emailTrimmed,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      // Opret i users-tabellen (kopieret fra app logic)
      try {
        const userId = data?.user?.id || data?.session?.user?.id;
        const userEmail = data?.user?.email || data?.session?.user?.email || emailTrimmed;
        
        if (userId && userEmail) {
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

          if (!existing) {
            await supabase.from('users').insert([{ id: userId, email: userEmail }]);
          }
        }
      } catch (err) {
        console.warn("Sekundær bruger-oprettelse fejl (ikke kritisk):", err);
      }

      alert('Succes! Din bruger er oprettet. Tjek din email for at bekræfte, og log derefter ind.');
      router.push('/login'); // Send brugeren til login-siden

    } catch (e: any) {
      alert(e?.message || 'Noget gik galt. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171C22] flex flex-col items-center justify-center p-4 font-sans">
      
      {/* Tilbage knap */}
      <button 
        onClick={() => router.push('/')} 
        className="absolute top-8 left-8 text-white text-4xl hover:opacity-70 transition-opacity"
      >
        ‹
      </button>

      <div className="w-full max-w-sm flex flex-col items-center">
        
        <h1 className="text-white text-3xl font-bold mb-4 tracking-wide mt-10">Opret bruger</h1>
        
        <p className="text-gray-400 text-sm text-center mb-8 px-4 leading-relaxed">
          Vi gemmer kun din email for at kunne vise din profil.<br/>
          Vi deler den aldrig med andre.
        </p>

        <form onSubmit={handleSignup} className="w-full flex flex-col items-center gap-4">
          
          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            className="w-[260px] h-12 rounded-full px-5 text-base bg-white text-black outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* Password */}
          <div className="relative w-[260px]">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min. 8 tegn)"
              className="w-full h-12 rounded-full px-5 pr-10 text-base bg-white text-black outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative w-[260px]">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Bekræft password"
              className="w-full h-12 rounded-full px-5 pr-10 text-base bg-white text-black outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
            >
              <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>

          {/* Validerings-hints */}
          <div className="w-[260px] flex flex-col gap-1 mt-1">
            {!isEmailValid && email.length > 0 && (
              <span className="text-red-300 text-xs text-center">Indtast en gyldig email-adresse.</span>
            )}
            {!isPasswordStrong && password.length > 0 && (
              <span className="text-red-300 text-xs text-center">Password skal være mindst 8 tegn.</span>
            )}
            {!passwordsMatch && confirm.length > 0 && (
              <span className="text-red-300 text-xs text-center">Passwords er ikke ens.</span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-[260px] h-12 rounded-full mt-4 font-bold text-base tracking-wide transition-all
              ${canSubmit 
                ? 'bg-white text-black hover:bg-gray-200 cursor-pointer shadow-lg' 
                : 'bg-white/50 text-black/50 cursor-not-allowed'
              }
            `}
          >
            {loading ? 'OPRETTER...' : 'OPRET BRUGER'}
          </button>

        </form>
      </div>
    </div>
  );
}