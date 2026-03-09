import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      firestoreId: string;
      username: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
