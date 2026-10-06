import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAuthConfigured } from "./lib/access";
import { getDashboardUserByEmail, touchLastLogin } from "./lib/users";

const authReady = isAuthConfigured();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || "pitch-health-setup-mode-only",
  providers: authReady
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID!,
          clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!authReady) return false;

      try {
        const dashboardUser = await getDashboardUserByEmail(user.email);
        if (!dashboardUser || dashboardUser.status !== "active") return false;

        if (user.email) {
          await touchLastLogin(user.email);
        }

        return true;
      } catch (error) {
        console.error("Supabase user lookup failed during sign-in", error);
        return false;
      }
    },
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
