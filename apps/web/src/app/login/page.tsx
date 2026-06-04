"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, ShieldAlert, Cpu } from "lucide-react";
import { GridBackground } from "@/components/GridBackground";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = async (credentialResponse: any) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/v1/auth/google`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: credentialResponse.credential }),
        }
      );

      if (!res.ok) throw new Error("Login failed.");

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError("Login failed: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-violet-500/30">
      <GridBackground />
      {/* Left side: branding/imagery */}
      <div className="relative hidden lg:flex flex-1 flex-col justify-between p-12 border-r border-zinc-800 bg-zinc-950/50 backdrop-blur-sm z-10">
        <div>
          <Link href="/" className="font-bold text-2xl tracking-widest text-white">
            AYZO
          </Link>
          <div className="mt-4 uppercase tracking-widest text-xs text-violet-400 font-bold border border-violet-500/20 bg-violet-500/10 inline-block px-3 py-1 rounded-full">
            Enterprise Security
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md"
        >
          <h2 className="text-4xl font-bold mb-6 leading-tight">
            Secure your AI before someone else exploits it.
          </h2>
          <div className="flex flex-col gap-6 text-zinc-400">
            <div className="flex items-start gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
                <ShieldAlert className="text-violet-400" size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Automated Red Teaming</h4>
                <p className="text-sm">Thousands of adversarial prompts executed in minutes.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
                <Cpu className="text-violet-400" size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">CI/CD Integration</h4>
                <p className="text-sm">Block vulnerable models from reaching production.</p>
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className="text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} AYZO Security.
        </div>
      </div>

      {/* Right side: Login form */}
      <div className="flex flex-1 items-center justify-center p-8 z-10 relative">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden mb-12">
            <Link href="/" className="font-bold text-3xl tracking-widest text-white">
              AYZO
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-3">Welcome back</h1>
          <p className="text-zinc-400 mb-10">Sign in to access your security dashboard.</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-indigo-600 opacity-50"></div>
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest mb-1">Authenticate</h3>
              <p className="text-xs text-zinc-500">Continue securely with your Google Workspace</p>
            </div>
            
            <div className="flex justify-center w-full [&>div]:w-full transition-transform hover:scale-[1.02] active:scale-[0.98]">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => setError("Google login widget failed to load or encountered an error.")}
                theme="filled_black"
                size="large"
                shape="rectangular"
                width="100%"
                logo_alignment="center"
              />
            </div>

            <div className="mt-8 text-center">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                By continuing, you agree to our <a href="#" className="text-zinc-300 hover:text-white underline decoration-zinc-700 underline-offset-2">Terms of Service</a> and <a href="#" className="text-zinc-300 hover:text-white underline decoration-zinc-700 underline-offset-2">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
