"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-display mb-2">Check your email</h1>
          <p>We sent a sign-in link to <strong>{email}</strong>. Click it to come back signed in.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4">
        <h1 className="text-3xl font-display">Sign in to Byline</h1>
        <label className="block">
          <span className="block text-sm mb-1">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full bg-primary-500 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : "Send magic link"}
        </button>
        {errorMessage && <p role="alert" className="text-error-500 text-sm">{errorMessage}</p>}
      </form>
    </main>
  );
}
