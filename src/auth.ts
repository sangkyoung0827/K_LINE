import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { registerSiteMember } from "@/lib/siteAnalytics";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET
    })
  ],
  callbacks: {
    async signIn({ account, user }) {
      try {
        await registerSiteMember({
          email: user.email,
          imageUrl: user.image,
          name: user.name,
          provider: account?.provider ?? "google",
          providerAccountId: account?.providerAccountId
        });
      } catch (error) {
        console.error("K_LINE site member registration failed", error);
      }

      return true;
    }
  },
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt"
  }
});
