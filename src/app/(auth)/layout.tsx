import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Sign In | ScoutAI",
  description: "Sign in or create an account to start scouting with AI-powered strategy tools.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <div className="pt-16">
        {children}
      </div>
    </div>
  );
}
