import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Token Profile",
  description: "Track your LLM token usage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
