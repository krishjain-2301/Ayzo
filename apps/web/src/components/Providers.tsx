"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function Providers({ children }: { children: React.ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        localStorage.setItem("token", session.access_token);
        localStorage.setItem("user", JSON.stringify({
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "User",
          email: session.user.email || "",
          picture: session.user.user_metadata?.avatar_url || "",
        }));
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
