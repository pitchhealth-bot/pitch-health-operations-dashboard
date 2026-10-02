"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">P</div>
        <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
        <h1>Operations Dashboard</h1>
        <p>Sign in with your authorized Google account to access employee and licensing records.</p>
        <button
          className="google-login"
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          Continue with Google
        </button>
        <small>Access is limited to approved Pitch Health users.</small>
      </section>
    </main>
  );
}
