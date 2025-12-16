'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// RETTELSE HER: Vi bruger ../.. for at gå helt tilbage til roden og finde lib-mappen
import { supabase } from '../../lib/supabaseClient'; 
import Link from 'next/link';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Forhindrer siden i at genindlæse
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

      // Hvis succes, send brugeren til opslag-siden
      router.push('/opslag');
      
    } catch (error: any) {
      setErrorMsg(error.message || "Login fejlede. Prøv igen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171C22] flex flex-col items-center justify-center p-4">
      {/* Tilbage knap */}
      <div className="absolute top-6 left-6">
        <Link href="/" className="text-white text-4xl hover:opacity-80 transition-opacity">
          ‹
        </Link>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center">
        <h1 className="text-white text-3xl font-bold mb-8">Log ind</h1>

        <form onSubmit={onLogin} className="w-full flex flex-col items-center gap-4">
          
          {/* Email Input */}
          <input
            type="email"
            placeholder="Email"
            className="w-full max-w-[260px] h-12 rounded-full px-5 text-base bg-white text-black outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* Password Input */}
          <input
            type="password"
            placeholder="Password"
            className="w-full max-w-[260px] h-12 rounded-full px-5 text-base bg-white text-black outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {errorMsg && (
            <p className="text-red-400 text-sm mt-2 font-medium">{errorMsg}</p>
          )}

          {/* Login Knap */}
          <button
            type="submit"
            disabled={loading}
            className="w-[200px] h-[52px] bg-white rounded-full mt-4 flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-70"
          >
            <span className="text-[#171C22] font-bold text-base tracking-widest uppercase">
              {loading ? "Logger ind..." : "LOG IND"}
            </span>
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 flex flex-col items-center gap-6">
          <Link href="/glemt-kodeord" className="text-[#cfe2ff] font-bold text-[15px] underline hover:text-white transition-colors">
            Glemt kodeord?
          </Link>

          <div className="flex flex-col items-center gap-2">
            <Link href="/privacy" className="text-[#cfe2ff] font-bold text-[15px] underline hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/disclaimer" className="text-[#cfe2ff] font-bold text-[15px] underline hover:text-white transition-colors">
              Ansvarsfraskrivelse
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}