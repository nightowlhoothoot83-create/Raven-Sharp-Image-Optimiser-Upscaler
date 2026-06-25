import React from "react";
import ADGFooter from "../components/ADGFooter";

export default function About() {
  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <span className="text-xs font-mono uppercase tracking-widest text-[var(--gold)]">Our Story</span>
        <h1 className="font-display text-4xl font-black tracking-tighter mt-1 mb-2">
          The Owl &amp; The Raven
        </h1>
        <p className="text-xs text-[var(--muted)] mb-8">
          Why Raven Sharp exists
        </p>

        <div className="rounded-2xl overflow-hidden mb-6 border border-white/10">
          <img
            src="/about/owl-raven.png"
            alt="The Owl and the Raven"
            className="w-full object-cover"
          />
        </div>

        <div className="glass rounded-2xl p-8 mb-6 space-y-4">
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            The Owl is intuition. She sees the vision before it exists — the idea, the brand,
            the direction — built from instinct and creative force, with her own mind and her
            own hands.
          </p>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            The Raven is technology. <span className="text-[var(--text)]">It doesn't create
            the vision — it carries it.</span> It does the technical heavy lifting, the
            execution, the building at scale. It helps bring what the Owl sees in her mind into
            the world, faster and sharper than either could alone.
          </p>
          <p className="text-sm text-[var(--raven-glow)] italic">
            "I am the creator. It is the tool. Together we move."
          </p>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            That's the philosophy behind Raven Sharp — and every brand under Ascension
            Digital. Human intuition leading. Technology executing. Real AI upscaling, real
            background removal, real platform-ready exports — built so creators can focus on
            the art, not the technical grind.
          </p>
        </div>

        <div className="glass rounded-2xl p-8 mb-6">
          <h2 className="font-display text-lg font-bold mb-3">Built in Queensland, Australia</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Raven Sharp is part of the <a href="https://ascensiondigitalgroup.com"
              target="_blank" rel="noreferrer"
              className="text-[var(--raven-glow)] hover:underline">Ascension Digital Group</a> —
            a multi-brand digital ecosystem built by one founder, powered by vision and AI.
          </p>
        </div>
      </div>
      <ADGFooter />
    </div>
  );
}
