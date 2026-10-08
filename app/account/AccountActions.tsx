"use client";

import { useState } from "react";

export default function AccountActions() {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="account-actions">
      <button
        className="user-delete-button"
        type="button"
        disabled={signingOut}
        onClick={signOut}
      >
        {signingOut ? "Signing Out..." : "Sign Out"}
      </button>
    </div>
  );
}
