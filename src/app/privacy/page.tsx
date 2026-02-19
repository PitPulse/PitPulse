import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy | PitPilot",
  description:
    "Learn what information PitPilot collects, how we use it, and how we protect team data.",
};

const EFFECTIVE_DATE = "February 15, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-300">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="marketing-shell text-white">
      <Navbar />

      <main className="marketing-content mx-auto max-w-5xl px-4 pb-16 pt-32">
        <div className="marketing-card relative overflow-hidden rounded-3xl p-8">
          <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
              Privacy Policy
            </p>
            <h1 className="mt-2 text-3xl font-bold">How PitPilot handles your data</h1>
            <p className="mt-3 max-w-3xl text-sm text-gray-300">
              We built PitPilot for FRC teams, and we treat team scouting data with care. This
              page explains what we collect, why we collect it, and what controls you have.
            </p>
            <p className="mt-3 text-xs text-gray-400">Effective date: {EFFECTIVE_DATE}</p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <Section title="Information We Collect">
            <p>
              Account information: email, display name, and team membership details needed to
              authenticate users and manage access.
            </p>
            <p>
              Team data: scouting entries, match notes, role assignments, and event sync metadata
              created while using PitPilot.
            </p>
            <p>
              Operational data: limited technical information needed to run the app reliably, such
              as rate-limit counters and sync status.
            </p>
            <p>
              Billing data: payments are processed by Stripe. We do not store full card numbers in
              PitPilot.
            </p>
          </Section>

          <Section title="How We Use Information">
            <p>We use data to authenticate users, provide team features, and generate AI briefs.</p>
            <p>We use operational signals to prevent abuse and keep the service stable.</p>
            <p>
              We use billing status to enable paid plan access, including Supporter and gifted
              access states.
            </p>
          </Section>

          <Section title="Data Sharing">
            <p>
              We do not sell personal data. We share data only with service providers needed to run
              PitPilot, such as Supabase (data storage/auth), Anthropic (AI generation), and Stripe
              (billing).
            </p>
            <p>
              We may disclose information if required by law, to protect users, or to prevent
              abuse.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              Team data remains available while your organization uses PitPilot. Captains can
              remove members, and users can leave teams from settings.
            </p>
            <p>
              When a team is deleted by a captain, associated team records are removed from active
              app use.
            </p>
          </Section>

          <Section title="Your Controls">
            <p>Captains can manage members, roles, and team settings.</p>
            <p>Users can update profile information and leave an organization.</p>
            <p>
              For privacy requests or questions, contact us via{" "}
              <Link href="/contact" className="text-teal-300 hover:text-teal-200">
                the contact page
              </Link>
              .
            </p>
          </Section>

          <Section title="Policy Updates">
            <p>
              We may update this policy over time. Material changes will be reflected by updating
              the effective date on this page.
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
