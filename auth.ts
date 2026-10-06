import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDashboardUserByEmail, touchLastLogin } from "./lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
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
