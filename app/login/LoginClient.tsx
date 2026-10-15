"use client";

import { useState } from "react";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [message, setMessage] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

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

  async function resetPassword() {
    if (!email || resetting) return;

    setResetting(true);
    setResetMessage("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not send reset email.");
      }

      setResetMessage(
        "Check your email for a secure link to create a new password.",
      );
    } catch (error) {
      setResetMessage(
        error instanceof Error ? error.message : "Could not send reset email.",
      );
    } finally {
      setResetting(false);
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

        <div className="login-password-wrap">
          <input
            className="login-email-input login-password-input"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete="current-password"
            onKeyDown={event => {
              if (event.key === "Enter" && email && password && !signingIn) signIn();
            }}
          />
          <button
            type="button"
            className="login-password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(value => !value)}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c5.2 0 9.5 4.3 10 8-.2 1.5-1.1 3.2-2.5 4.6M6.6 6.6C4.1 8.1 2.4 10.2 2 12c.5 3.7 4.8 8 10 8 1.5 0 2.9-.4 4.1-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12c.5-3.7 4.8-8 10-8s9.5 4.3 10 8c-.5 3.7-4.8 8-10 8S2.5 15.7 2 12z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
            )}
          </button>
        </div>

        <button
          className="google-login"
          onClick={signIn}
          disabled={!email || !password || signingIn}
        >
          {signingIn ? "Signing In..." : "Sign In"}
        </button>

        {message && <div className="login-message">{message}</div>}

        <button
          type="button"
          className="login-reset-link"
          onClick={resetPassword}
          disabled={!email || resetting}
        >
          {resetting ? "Sending reset link..." : "Forgot password?"}
        </button>

        {resetMessage && (
          <div className="login-reset-message">{resetMessage}</div>
        )}

        <small>First time here? Use the invite email from your Super Admin to create your password.</small>
      </section>
    </main>
  );
}
