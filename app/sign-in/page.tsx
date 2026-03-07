"use client";

import { GithubAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { useEffect } from "react";

export default function SignInPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      // Redirect existing users to their profile
      const userRef = doc(db, "users", user.uid);
      getDoc(userRef).then((snap) => {
        if (snap.exists()) {
          router.push(`/${snap.data().username}`);
        } else {
          router.push("/settings");
        }
      });
    }
  }, [user, loading, router]);

  async function signInWithGitHub() {
    const provider = new GithubAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check if user doc exists, create if not
      const userRef = doc(db, "users", firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Get GitHub username from provider data
        const githubUsername =
          firebaseUser.providerData[0]?.displayName ||
          firebaseUser.displayName ||
          firebaseUser.email?.split("@")[0] ||
          firebaseUser.uid;

        await setDoc(userRef, {
          username: githubUsername.toLowerCase().replace(/\s+/g, "-"),
          displayName: firebaseUser.displayName || "",
          bio: "",
          avatarUrl: firebaseUser.photoURL || "",
          apiKey: crypto.randomUUID() + crypto.randomUUID().replace(/-/g, ""),
          createdAt: new Date(),
        });
      }

      // Existing user -> profile, new user -> settings
      if (userSnap.exists()) {
        const existingData = userSnap.data();
        router.push(`/${existingData.username}`);
      } else {
        router.push("/settings");
      }
    } catch (error) {
      console.error("Sign in failed:", error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">Sign in to Token Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">Track your LLM token usage</p>
        <button
          onClick={signInWithGitHub}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}
