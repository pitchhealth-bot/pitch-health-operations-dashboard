"use client";

import { useMemo, useState } from "react";

export default function AcceptInvitePage() {
  const params = useMemo(() => {
    if (typeof window === "undefined") return { tokenHash: "", type: "invite" as const };
    const url = new URL(window.location.href);
    return {
      tokenHash: url.searchParams.get("token_hash") || "",
      type: url.searchParams.get("type") === "recovery" ? "recovery" as const : "invite" as const,
    };
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function finishSetup() {
    setMessage("");

    if (!params.tokenHash) {
      setMessage("This account setup link is missing a valid token.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenHash: params.tokenHash,
          type: params.type,
          password,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not finish account setup.");
      }

      window.history.replaceState({}, "", "/auth/accept");
      window.location.replace(
        json.role === "agent" && json.airtableAgentRecordId
          ? `/agents/${json.airtableAgentRecordId}`
          : "/",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not finish account setup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">P</div>
        <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
        <h1>Create your password</h1>
        <p>Set the password you’ll use to sign in to the Operations Dashboard.</p>

        <input
          className="login-email-input"
          type="password"
          placeholder="Create password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />

        <input
          className="login-email-input"
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={event => setConfirm(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !saving) finishSetup();
          }}
        />

        <button
          className="google-login"
          onClick={finishSetup}
          disabled={saving || !password || !confirm}
        >
          {saving ? "Creating Account..." : "Create Password & Continue"}
        </button>

        {message && <div className="login-message">{message}</div>}
        <small>Password must be at least 8 characters.</small>
      </section>
    </main>
  );
}
