"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginClient({ authReady }: { authReady: boolean }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">P</div>
        <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
        <h1>Operations Dashboard</h1>

        {authReady ? (
          <>
            <p>Sign in with your authorized Google account to access employee and licensing records.</p>
            <button
              className="google-login"
              onClick={() => signIn("google", { redirectTo: "/" })}
            >
              Continue with Google
            </button>
            <small>Access is limited to approved Pitch Health users.</small>
          </>
        ) : (
          <>
            <p>Google sign-in is not configured yet. The dashboard is currently running in Setup Admin mode.</p>
            <Link className="google-login login-home-link" href="/">
              Return to Dashboard
            </Link>
            <small>Finish Google OAuth setup before enabling sign-in.</small>
          </>
        )}
      </section>
    </main>
  );
}
