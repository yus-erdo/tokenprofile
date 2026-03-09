import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { adminDb } from "@/lib/firebase/admin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.id) return false;

      const firestoreId = String(profile.id);
      const userRef = adminDb.collection("users").doc(firestoreId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        const username = String(profile.login || profile.name || profile.id)
          .toLowerCase()
          .replace(/\s+/g, "-");

        await userRef.set({
          username,
          displayName: profile.name || "",
          bio: "",
          avatarUrl: profile.avatar_url || "",
          location: (profile as Record<string, unknown>).location as string || "",
          website: (profile as Record<string, unknown>).blog as string || "",
          apiKey: crypto.randomUUID() + crypto.randomUUID().replace(/-/g, ""),
          createdAt: new Date(),
          hasOnboarded: false,
          interests: [],
        });
      } else {
        // Backfill location/website from GitHub if empty
        const data = userSnap.data()!;
        const updates: Record<string, string> = {};
        const ghLocation = (profile as Record<string, unknown>).location as string;
        const ghBlog = (profile as Record<string, unknown>).blog as string;
        if (!data.location && ghLocation) updates.location = ghLocation;
        if (!data.website && ghBlog) updates.website = ghBlog;
        if (Object.keys(updates).length > 0) {
          await userRef.update(updates);
        }
      }

      return true;
    },

    async jwt({ token, profile }) {
      if (profile?.id) {
        const firestoreId = String(profile.id);
        token.firestoreId = firestoreId;

        const userSnap = await adminDb.collection("users").doc(firestoreId).get();
        if (userSnap.exists) {
          token.username = userSnap.data()!.username;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.firestoreId) {
        session.user.firestoreId = token.firestoreId as string;
      }
      if (token.username) {
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
