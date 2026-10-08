"use client";

import { useState } from "react";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [message, setMessage] = useState("");

  async function signIn() {
    setSigningIn(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not sign in.");
      }

      window.location.replace(
        json.role === "agent" && json.airtableAgentRecordId
          ? `/agents/${json.airtableAgentRecordId}`
          : "/",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">P</div>
        <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
        <h1>Operations Dashboard</h1>
        <p>Sign in with the email and password attached to your dashboard account.</p>

        <input
          className="login-email-input"
          type="email"
          placeholder="you@pitchhealthsolutions.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          autoComplete="email"
        />

        <input
          className="login-email-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="current-password"
          onKeyDown={event => {
            if (event.key === "Enter" && email && password && !signingIn) signIn();
          }}
        />

        <button
          className="google-login"
          onClick={signIn}
          disabled={!email || !password || signingIn}
        >
          {signingIn ? "Signing In..." : "Sign In"}
        </button>

        {message && <div className="login-message">{message}</div>}
        <small>First time here? Use the invite email from your Super Admin to create your password.</small>
      </section>
    </main>
  );
}
