"use client";

import { GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WaveBackground } from "@/components/WaveBackground";

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-void)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <WaveBackground opacity={1} />

      <div
        className="surface animate-in"
        style={{
          padding: "48px 40px",
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
          position: "relative",
        }}
      >
        <div>
          <span
            className="logo-wordmark"
            style={{ fontSize: "22px", display: "block", textAlign: "center" }}
          >
            AYZO
          </span>
        </div>

        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              marginBottom: "8px",
            }}
          >
            Sign in to AYZO
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            Access your dashboard and security assessments
          </p>
        </div>

        {error && (
          <div
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--red-soft)",
              color: "var(--red)",
              fontSize: "13px",
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("Google login failed. Please try again.")}
            theme="filled_black"
            shape="pill"
          />
        </div>

        <p
          style={{
            fontSize: "12px",
            color: "var(--text-tertiary)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          By signing in, you agree to AYZO&apos;s terms of service.
        </p>
      </div>
    </div>
  );
}
