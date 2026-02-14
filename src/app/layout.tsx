import type { Metadata, Viewport } from "next";
import { Geist, Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { OnlineStatus } from "@/components/online-status";
import { RouteLoading } from "@/components/route-loading";
import { ToastProvider } from "@/components/toast";
import { PageTransition } from "@/components/page-transition";
import { SmoothScroll } from "@/components/smooth-scroll";
import { getSiteUrl } from "@/lib/site-url";

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

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PitPilot | AI-Powered FRC Scouting",
  description:
    "Scouting and strategy platform built specifically for FIRST Robotics Competition (FRC) teams.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  keywords: [
    "FRC scouting",
    "FIRST Robotics Competition",
    "robotics scouting app",
    "FRC strategy",
    "FRC match scouting",
    "PitPilot",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PitPilot",
  },
  openGraph: {
    type: "website",
    siteName: "PitPilot",
    title: "PitPilot | AI-Powered FRC Scouting",
    description:
      "Scouting and strategy platform built specifically for FIRST Robotics Competition (FRC) teams.",
    url: "/",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "PitPilot logo and tagline",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PitPilot | AI-Powered FRC Scouting",
    description:
      "Scouting and strategy platform built specifically for FIRST Robotics Competition (FRC) teams.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#03070a" },
    { media: "(prefers-color-scheme: dark)", color: "#03070a" },
  ],
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
