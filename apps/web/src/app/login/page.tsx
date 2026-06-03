"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = async (credentialResponse: any) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      if (!res.ok) {
        throw new Error("Login failed.");
      }

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="glass-panel" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', maxWidth: '400px', width: '100%' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="logo-icon animate-pulse-glow"></div>
          <h1 className="logo-text" style={{ fontSize: '2rem' }}>AYZO</h1>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Welcome Back</h2>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Log in to your dashboard to continue</p>
        </div>

        {error && (
          <div className="badge danger" style={{ width: '100%', textAlign: 'center', padding: '0.75rem' }}>
            {error}
          </div>
        )}

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => {
              setError('Google login failed. Please try again.');
            }}
            useOneTap
            theme="filled_black"
          />
        </div>
      </div>
    </div>
  );
}
