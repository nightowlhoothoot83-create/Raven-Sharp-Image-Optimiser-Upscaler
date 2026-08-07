import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Image as ImageIcon, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import ADGFooter from "../components/ADGFooter";

const LIMITS = { free: 5, standard: 100, pro: 3000, owner: 99999 };

export default function Account() {
  const { user, checkAuth } = useAuth();
  const tier = user?.tier || "free";
  const limit = LIMITS[tier] || LIMITS.free;
  const used = Number(user?.images_used || 0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("session_id")) {
      checkAuth().finally(() => {
        toast.success("Payment received. Your plan is being updated.");
        window.history.replaceState({}, "", "/account");
      });
    }
  }, [checkAuth]);

  return (
    <div className="min-h-screen pt-24">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--raven-glow)]">Raven Sharp Image Optimiser</span>
            <h1 className="font-display text-4xl font-black tracking-tight mt-2">Your account</h1>
          </div>
          <Link to="/pricing" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--raven)] to-[var(--raven-blue)] text-white text-sm font-semibold">View Plans</Link>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl bg-[var(--raven)]/15 text-[var(--raven-glow)] grid place-items-center"><UserRound className="w-5 h-5" /></div><div><h2 className="font-display text-lg font-bold">Profile</h2><p className="text-xs text-[var(--muted)]">Account identity and current plan</p></div></div>
            <dl className="space-y-4 text-sm">
              <div><dt className="text-[var(--subtle)] text-xs uppercase tracking-wider">Name</dt><dd className="mt-1">{user?.name || "Raven Sharp user"}</dd></div>
              <div><dt className="text-[var(--subtle)] text-xs uppercase tracking-wider">Email</dt><dd className="mt-1 break-all">{user?.email}</dd></div>
              <div><dt className="text-[var(--subtle)] text-xs uppercase tracking-wider">Plan</dt><dd className="mt-1 capitalize text-[var(--raven-glow)] font-semibold">{tier}</dd></div>
            </dl>
          </section>

          <section className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)] grid place-items-center"><ImageIcon className="w-5 h-5" /></div><div><h2 className="font-display text-lg font-bold">Monthly usage</h2><p className="text-xs text-[var(--muted)]">Images processed this billing period</p></div></div>
            {tier === "owner" ? <div className="text-3xl font-display font-black">Unlimited</div> : <><div className="flex items-end justify-between mb-2"><span className="text-3xl font-display font-black">{used}</span><span className="text-sm text-[var(--muted)]">of {limit}</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-[var(--raven)]" style={{width:`${Math.min(100, (used / limit) * 100)}%`}} /></div></>}
            <div className="flex gap-2 items-center mt-5 text-xs text-[var(--muted)]"><CheckCircle2 className="w-4 h-4 text-emerald-400" />Your processing history is available from the History page.</div>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap gap-3"><Link to="/optimiser" className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold">Open Optimiser</Link><Link to="/history" className="px-5 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold text-[var(--muted)]">View History</Link></div>
      </main>
      <ADGFooter />
    </div>
  );
}
