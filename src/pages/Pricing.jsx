import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import ADGFooter from "../components/ADGFooter";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Try the complete workflow before upgrading.",
    perks: ["5 images/month", "Batch up to 3", "Editing tools", "Watermarked output"],
  },
  {
    id: "standard",
    name: "Standard",
    price: 10,
    description: "For regular creators and photographers.",
    perks: ["100 images/month", "Batch up to 10", "AI upscaling", "No watermark", "All editing tools"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 15,
    description: "For high-volume image and POD work.",
    perks: ["3,000 images/month", "Batch up to 50", "AI upscaling", "No watermark", "Priority processing"],
    featured: true,
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(null);

  const choose = async (tier) => {
    if (tier === "free") return;
    if (!user) {
      window.location.href = `/register?tier=${tier}`;
      return;
    }
    setBusy(tier);
    try {
      const { data } = await api.post("/billing/checkout", { tier, billing: "monthly" });
      if (!data?.checkout_url) throw new Error("Checkout URL was not returned");
      window.location.href = data.checkout_url;
    } catch (error) {
      toast.error(error.userMessage || error.response?.data?.detail || "Checkout could not be started. Please try again.");
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen pt-24">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--gold)]">Raven Sharp Image Optimiser</span>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight mt-3">Simple image-processing plans.</h1>
          <p className="text-[var(--muted)] mt-4">Start free, then upgrade when you need larger batches and more monthly processing.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const current = user?.tier === tier.id;
            return (
              <article key={tier.id} className={`relative rounded-2xl p-7 flex flex-col ${tier.featured ? "bg-gradient-to-b from-[var(--raven)]/20 to-[var(--surface)] border border-[var(--raven)]/40" : "glass"}`}>
                {tier.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest bg-[var(--raven)] text-white px-3 py-1 rounded-full"><Star className="w-3 h-3" /> Best Value</span>}
                <h2 className="font-display text-xl font-bold">{tier.name}</h2>
                <p className="text-xs text-[var(--muted)] mt-1 min-h-10">{tier.description}</p>
                <div className="flex items-baseline gap-1 my-5"><span className="font-display text-4xl font-black">A${tier.price}</span>{tier.price > 0 && <span className="text-sm text-[var(--muted)]">/mo</span>}</div>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {tier.perks.map((perk) => <li key={perk} className="flex gap-2 text-sm text-[var(--muted)]"><Check className="w-4 h-4 text-[var(--raven-glow)] shrink-0 mt-0.5" />{perk}</li>)}
                </ul>
                {tier.id === "free" ? (
                  <Link to={user ? "/optimiser" : "/register"} className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold flex items-center justify-center">{user ? "Open Optimiser" : "Start Free"}</Link>
                ) : (
                  <button type="button" onClick={() => choose(tier.id)} disabled={current || busy === tier.id} className="w-full h-11 rounded-xl bg-gradient-to-r from-[var(--raven)] to-[var(--raven-blue)] hover:brightness-110 text-white text-sm font-semibold disabled:opacity-50">
                    {current ? "Current Plan" : busy === tier.id ? "Opening checkout…" : `Choose ${tier.name}`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <p className="text-center text-xs text-[var(--subtle)] mt-7">Prices shown in AUD. Cancel anytime. <Link to="/legal/refunds" className="text-[var(--raven-glow)] hover:underline">Refund policy</Link></p>
      </main>
      <ADGFooter />
    </div>
  );
}
