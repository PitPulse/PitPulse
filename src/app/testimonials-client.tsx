"use client";

import { motion } from "framer-motion";

interface Testimonial {
  id?: string;
  quote: string;
  name: string;
  role: string;
  team: string;
  rating?: number;
}

interface TestimonialsClientProps {
  testimonials: Testimonial[];
}

export function TestimonialsClient({ testimonials }: TestimonialsClientProps) {
  return (
    <section id="testimonials" className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">
            Testimonials
          </p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Teams love ScoutAI
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-400">
            Hear from teams who use ScoutAI to gain an edge at events.
          </p>
        </div>

        {testimonials.length === 0 ? (
          <div className="mt-16 rounded-xl border border-white/10 bg-gray-900/50 p-6 text-center text-sm text-gray-400">
            No testimonials yet. Check back soon.
          </div>
        ) : (
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, i) => {
              const stars = Math.max(1, Math.min(5, t.rating ?? 5));
              return (
                <motion.div
                  key={t.id ?? `${t.name}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="rounded-xl border border-white/10 bg-gray-900/50 p-6"
                >
                  <div className="mb-4 flex gap-0.5 text-yellow-500">
                    {Array.from({ length: stars }).map((_, si) => (
                      <svg
                        key={si}
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>

                  <p className="text-sm leading-relaxed text-gray-300">
                    &ldquo;{t.quote}&rdquo;
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.role} &middot; {t.team}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
