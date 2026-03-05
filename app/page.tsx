import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold">Token Profile</h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto">
          Track your LLM token usage across projects with beautiful heatmaps and detailed stats.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
