"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ShieldAlert, Cpu, Mail, Lock, User, ArrowRight, CheckCircle2 } from "lucide-react";
import { GridBackground } from "@/components/GridBackground";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleGoogleLogin = async (credentialResponse: any) => {
    try {
      setError(null);
      setSuccess(null);
      if (!credentialResponse.credential) {
        throw new Error("No credential received from Google login");
      }
      
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credentialResponse.credential,
      });
      
      if (error) throw error;
      
      if (data.session && data.user) {
        localStorage.setItem("token", data.session.access_token);
        localStorage.setItem("user", JSON.stringify({
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || "User",
          email: data.user.email || "",
          picture: data.user.user_metadata?.avatar_url || "",
        }));
      }
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google authentication failed.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (isLoginMode) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session && data.user) {
          localStorage.setItem("token", data.session.access_token);
          localStorage.setItem("user", JSON.stringify({
            name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || "User",
            email: data.user.email || "",
            picture: data.user.user_metadata?.avatar_url || "",
          }));
        }
        router.push("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            }
          }
        });
        if (error) throw error;
        
        if (data.session && data.user) {
          localStorage.setItem("token", data.session.access_token);
          localStorage.setItem("user", JSON.stringify({
            name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || "User",
            email: data.user.email || "",
            picture: data.user.user_metadata?.avatar_url || "",
          }));
        }
        
        // Show success message asking to check email
        setSuccess("Success! Please check your email for a verification link.");
        // We can optionally clear the form here
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#030303] text-white font-sans selection:bg-violet-500/30 overflow-hidden relative">
      <GridBackground />
      
      {/* Decorative ambient gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Left side: branding/imagery */}
      <div className="relative hidden lg:flex flex-1 flex-col justify-between p-16 border-r border-white/[0.05] bg-black/40 backdrop-blur-3xl z-10">
        <div>
          <Link href="/" className="flex items-center gap-3 w-fit group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
              <ShieldAlert size={18} className="text-white" />
            </div>
            <span className="font-bold text-2xl tracking-widest text-white">AYZO</span>
          </Link>
          <div className="mt-6 uppercase tracking-widest text-[10px] text-violet-300 font-bold border border-violet-500/20 bg-violet-500/10 inline-block px-3 py-1.5 rounded-full shadow-inner">
            Enterprise Security
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-lg"
        >
          <h2 className="text-[2.75rem] font-bold mb-8 leading-[1.1] tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-500">
            Secure your AI before someone else exploits it.
          </h2>
          <div className="flex flex-col gap-8 text-zinc-400">
            <motion.div 
              whileHover={{ x: 5 }}
              className="flex items-start gap-5 p-4 -ml-4 rounded-2xl hover:bg-white/[0.02] transition-colors cursor-default"
            >
              <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/10 p-3 rounded-xl shadow-lg">
                <ShieldAlert className="text-violet-400" size={24} />
              </div>
              <div className="pt-1">
                <h4 className="font-semibold text-zinc-100 mb-1.5 text-lg">Automated Red Teaming</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">Thousands of adversarial prompts executed and analyzed in minutes, finding zero-days before attackers do.</p>
              </div>
            </motion.div>
            <motion.div 
              whileHover={{ x: 5 }}
              className="flex items-start gap-5 p-4 -ml-4 rounded-2xl hover:bg-white/[0.02] transition-colors cursor-default"
            >
              <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border border-white/10 p-3 rounded-xl shadow-lg">
                <Cpu className="text-violet-400" size={24} />
              </div>
              <div className="pt-1">
                <h4 className="font-semibold text-zinc-100 mb-1.5 text-lg">CI/CD Integration</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">Block vulnerable models and prompts from reaching production with seamless pipeline integrations.</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="text-xs text-zinc-600 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span>SOC2 Type II Compliant &middot; &copy; {new Date().getFullYear()} AYZO Security.</span>
        </div>
      </div>

      {/* Right side: Login form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12 z-10 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="lg:hidden mb-12 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <ShieldAlert size={18} className="text-white" />
            </div>
            <Link href="/" className="font-bold text-2xl tracking-widest text-white">
              AYZO
            </Link>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight text-white">
              {isLoginMode ? "Welcome back" : "Create an account"}
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base">
              {isLoginMode 
                ? "Sign in to access your security dashboard." 
                : "Join AYZO to secure your LLM deployments."}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 backdrop-blur-sm"
            >
              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-300 leading-relaxed font-medium">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3 backdrop-blur-sm"
            >
              <CheckCircle2 className="text-green-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-green-300 leading-relaxed font-medium">{success}</p>
            </motion.div>
          )}

          <div className="bg-zinc-900/40 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative">
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="popLayout">
                {!isLoginMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input 
                        type="text" 
                        required={!isLoginMode}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-black/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                  {isLoginMode && (
                    <a href="#" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Forgot?</a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl py-3 mt-4 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {isLoading ? "Please wait..." : (isLoginMode ? "Sign In" : "Create Account")}
                {!isLoading && <ArrowRight size={18} className="text-zinc-400 group-hover:text-black group-hover:translate-x-1 transition-all" />}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Or continue with</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
            </div>

            <div className="flex justify-center w-full [&>div]:w-full hover:brightness-110 transition-all">
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setError("Google login widget failed to load or encountered an error.")}
                theme="filled_black"
                size="large"
                shape="rectangular"
                width="100%"
                logo_alignment="center"
                text={isLoginMode ? "signin_with" : "signup_with"}
              />
            </div>
            
          </div>

          <p className="mt-8 text-center text-sm text-zinc-400">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError(null);
                setSuccess(null);
              }}
              className="text-white font-semibold hover:text-violet-400 transition-colors focus:outline-none"
            >
              {isLoginMode ? "Sign up" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

