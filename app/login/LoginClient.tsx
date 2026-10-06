"use client";

import { useState } from "react";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function sendLink() {
    setSending(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not send sign-in link.");

      setMessage("Check your email for your secure sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send sign-in link.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">P</div>
        <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
        <h1>Operations Dashboard</h1>
        <p>Enter the email address attached to your dashboard account. We’ll send you a secure sign-in link.</p>

        <input
          className="login-email-input"
          type="email"
          placeholder="you@pitchhealthsolutions.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && email && !sending) sendLink();
          }}
        />

        <button
          className="google-login"
          onClick={sendLink}
          disabled={!email || sending}
        >
          {sending ? "Sending..." : "Email Me a Sign-In Link"}
        </button>

        {message && <div className="login-message">{message}</div>}
        <small>Only users added by a Super Admin can access the dashboard.</small>
      </section>
    </main>
  );
}
