import type { Metadata, Viewport } from "next";
import { Geist, Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { OnlineStatus } from "@/components/online-status";
import { RouteLoading } from "@/components/route-loading";
import { ToastProvider } from "@/components/toast";
import { PageTransition } from "@/components/page-transition";
import { SmoothScroll } from "@/components/smooth-scroll";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PitPilot - AI-Powered FRC/FTC Scouting",
  description:
    "AI-powered scouting and strategy platform for FRC and FTC robotics teams",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PitPilot",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" style={{ colorScheme: "dark" }}>
      <head />
      <body
        className={`${inter.variable} ${geist.variable} ${jetbrainsMono.variable} ${outfit.variable} font-sans antialiased`}
      >
        <ToastProvider>
          <RouteLoading />
          <SmoothScroll />
          <PageTransition>{children}</PageTransition>
          <ServiceWorkerRegister />
          <OnlineStatus />
        </ToastProvider>
      </body>
    </html>
  );
}
