"use client";

import { useEffect, useState } from "react";

export default function AcceptInvitePage() {
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    async function finish() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const errorDescription = hash.get("error_description");

      if (errorDescription) {
        setMessage(errorDescription);
        return;
      }

      if (!accessToken) {
        setMessage("This sign-in link is missing a valid token.");
        return;
      }

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error || "Could not sign you in.");
        return;
      }

      window.location.replace(
        json.role === "agent" && json.airtableAgentRecordId
          ? `/agents/${json.airtableAgentRecordId}`
          : "/",
      );
    }

    finish();
  }, []);

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">P</div>
        <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
        <h1>Signing you in</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
