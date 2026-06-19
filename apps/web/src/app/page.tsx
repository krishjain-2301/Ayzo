"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Database,
  UserX,
  Target,
  Cpu,
  FileText,
} from "lucide-react";
import { GridBackground } from "@/components/GridBackground";

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  return (
    <div className="relative min-h-screen selection:bg-violet-500/30 selection:text-white text-zinc-400">
      <div className="fixed inset-0 w-full h-full overflow-hidden opacity-80 pointer-events-none z-0 flex items-center justify-center">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain scale-[0.85]"
        >
          <source src="https://svs.gsfc.nasa.gov/vis/a030000/a030000/a030082/viirs_dnb_night_lights_rotating_earth_1080p.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800/60">
        <div className="w-full h-16 flex items-center justify-center relative">
          <div className="absolute left-6 md:left-10">
            <Link href="/" className="font-heading font-bold text-xl text-white tracking-wide">
              AYZO
            </Link>
          </div>
          <div className="hidden md:flex gap-6 text-sm font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-40 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center max-w-4xl"
        >
          <motion.div variants={itemVariants} className="mb-8 uppercase tracking-widest text-xs text-violet-400 border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 rounded-full font-semibold">
            AI Security Testing
          </motion.div>

          <motion.h1 variants={itemVariants} className="font-heading font-black text-6xl md:text-8xl text-white tracking-tight leading-[1.1] mb-6">
            Find what your AI <span className="text-violet-400">hides.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl max-w-2xl text-zinc-400 mb-10">
            Automated adversarial testing to discover prompt injection, data leakage, and role override vulnerabilities in minutes.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
            <Link
              href="/login"
              className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-3.5 rounded-full font-semibold transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] flex items-center justify-center"
            >
              Start Free Assessment &rarr;
            </Link>
          </motion.div>
        </motion.div>
      </main>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="font-heading text-4xl font-bold text-white mb-12 text-center"
          >
            Built for adversarial depth
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ShieldAlert, title: "Prompt Injection Detection", desc: "Test defenses against jailbreaks, systemic overrides, and persona manipulation." },
              { icon: Database, title: "Data Leakage Testing", desc: "Identify if your model leaks PII, system prompts, or proprietary training data." },
              { icon: UserX, title: "Role Override Analysis", desc: "Verify strict adherence to assigned AI personas and permission boundaries." },
              { icon: Target, title: "17 Attack Vector Categories", desc: "Comprehensive testing across industry-standard AI vulnerability frameworks." },
              { icon: Cpu, title: "Async Execution Engine", desc: "Run thousands of adversarial tests in parallel without rate-limiting your app." },
              { icon: FileText, title: "Actionable Security Reports", desc: "Get detailed evidence of vulnerabilities with exact prompts and responses." },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-violet-500/30 hover:bg-zinc-900 hover:scale-[1.01] transition-all duration-300 backdrop-blur-sm group"
              >
                <h3 className="font-heading font-bold text-white text-2xl mb-3">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="relative z-10 py-24 px-6 border-t border-zinc-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16">
          <div className="lg:w-1/3">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="font-heading text-4xl font-bold text-white mb-4"
            >
              How it works
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-zinc-400 text-lg"
            >
              Four steps from target configuration to actionable security report.
            </motion.p>
          </div>

          <div className="lg:w-2/3 flex flex-col">
            {[
              { num: 1, title: "Connect your model", desc: "Configure your target LLM endpoint or agent application." },
              { num: 2, title: "Select attack vectors", desc: "Choose from our extensive library of adversarial testing categories." },
              { num: 3, title: "Automated execution", desc: "Our engine bombards the target with mutated, contextual attacks." },
              { num: 4, title: "Review your report", desc: "Analyze the findings, patch vulnerabilities, and re-test seamlessly." },
            ].map((step, i, arr) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 100 }}
                className="flex"
              >
                <div className="flex flex-col items-center mr-6">
                  <div className="w-8 h-8 rounded-full border border-zinc-700 bg-zinc-900 text-white flex items-center justify-center text-sm font-bold shrink-0 z-10">
                    {step.num}
                  </div>
                  {i !== arr.length - 1 && (
                    <div className="w-px h-full min-h-[60px] bg-zinc-800 my-2" />
                  )}
                </div>
                <div className="pb-8 pt-1">
                  <h3 className="font-heading font-semibold text-white text-lg mb-1">{step.title}</h3>
                  <p className="text-zinc-400">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900/50 py-12 text-center text-zinc-600 text-sm backdrop-blur-sm">
        <p></p>
      </footer>
    </div>
  );
}
