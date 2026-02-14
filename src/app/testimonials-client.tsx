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
    <section id="testimonials" className="relative py-24">
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <motion.div
        className="pointer-events-none absolute -left-8 top-20 h-28 w-28 rounded-full bg-teal-300/12 blur-3xl"
        animate={{ opacity: [0.18, 0.35, 0.18], y: [0, -8, 0] }}
        transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-8 bottom-16 h-32 w-32 rounded-full bg-cyan-300/12 blur-3xl"
        animate={{ opacity: [0.16, 0.32, 0.16], y: [0, 10, 0] }}
        transition={{ duration: 7.1, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <p className="section-label">Testimonials</p>
          <h2 className="font-outfit mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Trusted by teams in the stands
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
            PitPilot is built from real event workflow pain points: speed, clarity,
            and consistency under pressure.
          </p>
        </div>

        {testimonials.length === 0 ? (
          <div className="mt-14 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-10 text-center text-sm text-slate-500">
            No testimonials yet. Check back soon.
          </div>
        ) : (
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => {
              const stars = Math.max(1, Math.min(5, testimonial.rating ?? 5));
              return (
                <motion.article
                  key={testimonial.id ?? `${testimonial.name}-${index}`}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-70px" }}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                  className="group rounded-2xl border border-white/10 bg-[#0f1115]/85 p-6 backdrop-blur-md transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-teal-300/35 hover:shadow-[0_0_34px_-15px_rgba(67,217,162,0.58)]"
                >
                  <div className="mb-4 flex items-center gap-0.5 text-teal-200">
                    {Array.from({ length: stars }).map((_, starIndex) => (
                      <svg
                        key={starIndex}
                        xmlns="http://www.w3.org/2000/svg"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>

                  <p className="text-sm leading-relaxed text-slate-300">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>

                  <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-cyan-300 text-xs font-bold text-[#042116] shadow-[0_0_20px_-10px_rgba(67,217,162,0.8)]">
                      {testimonial.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">
                        {testimonial.role} · {testimonial.team}
                      </p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
