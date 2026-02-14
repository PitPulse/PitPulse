import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact | PitPilot",
  description: "Get in touch with the PitPilot team.",
};

export default function ContactPage() {
  return (
    <div className="marketing-shell text-white">
      <Navbar />

      <main className="marketing-content mx-auto max-w-5xl px-4 pb-16 pt-24">
        <div className="marketing-card relative overflow-hidden rounded-3xl p-8">
          <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
              Contact
            </p>
            <h1 className="mt-2 text-3xl font-bold">Let&apos;s talk strategy</h1>
            <p className="mt-3 max-w-2xl text-sm text-gray-300">
              Questions, feature requests, or partnership ideas? Leave a message
              and we&apos;ll respond as soon as we can.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <ContactForm />

          <div className="marketing-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold">What to include</h2>
            <p className="mt-1 text-sm text-gray-300">
              The more context you share, the faster we can help.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-gray-300">
              <li className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                Team number and competition week.
              </li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                What you were trying to do and what happened.
              </li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                Your device/browser and the exact error message if something broke.
              </li>
            </ul>
            <p className="mt-6 text-xs text-gray-500">
              Typical response time is within 24 hours during build season.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
