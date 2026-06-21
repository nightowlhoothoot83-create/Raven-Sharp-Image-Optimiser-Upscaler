import React from "react";
import { Link } from "react-router-dom";
import ADGFooter from "../components/ADGFooter";
import { ArrowRight, Check, Zap, Crop, Type, Sliders, Shield, Download, Star } from "lucide-react";

const FEATURES = [
  { icon:<Zap className="w-5 h-5"/>,     title:"True AI Upscaling",       desc:"Real-ESRGAN via Replicate — genuine pixel reconstruction from a trained model. Not bicubic. Not canvas resize. Actual AI." },
  { icon:<Crop className="w-5 h-5"/>,    title:"Crop Tool",                desc:"Interactive crop with aspect ratio lock (1:1, 4:3, 3:2, A4 etc.), rule-of-thirds overlay, and per-image crop memory for batches." },
  { icon:<Sliders className="w-5 h-5"/>, title:"Full Enhancement Suite",   desc:"Unsharp mask sharpen, brightness, contrast, saturation, auto-enhance. Local background removal — runs in your browser, no API key." },
  { icon:<Type className="w-5 h-5"/>,    title:"Watermark",                desc:"Text watermark with 9 position options, opacity and size control. Free accounts get automatic watermark. Paid removes it." },
  { icon:<Shield className="w-5 h-5"/>,  title:"DPI Injection",            desc:"Writes DPI correctly into PNG pHYs chunk and JPEG APP0. Gelato, Printify and other print platforms read the metadata and don't reject your files." },
  { icon:<Download className="w-5 h-5"/>,title:"Batch + ZIP",              desc:"Process up to 50 images at once on Pro tier. Preview before/after inline. Download individually or as a single ZIP." },
];

const TIERS = [
  { name:"Free",     price:"0",  period:"",    desc:"Try it out, no card needed.",           perks:["5 images/month","1 at a time","Watermark on output","All editing tools"], cta:"Start Free", featured:false },
  { name:"Standard", price:"10", period:"/mo", desc:"Regular creators, photographers.",       perks:["100 images/month","Batch of 10","No watermark","AI upscaling","All tools"], cta:"Go Standard", featured:false },
  { name:"Pro",      price:"15", period:"/mo", desc:"High volume, no compromises.", perks:["3,000 images/month","Batch of 50","No watermark","AI upscaling","Priority processing"], cta:"Go Pro", featured:true },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[var(--raven)]/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-[var(--gold)]/5 rounded-full blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.025]" style={{backgroundImage:"linear-gradient(90deg,rgba(124,92,191,.5) 1px,transparent 1px),linear-gradient(0deg,rgba(124,92,191,.5) 1px,transparent 1px)",backgroundSize:"80px 80px"}} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[var(--raven)]/20 blur-3xl scale-150" />
              <img src="/brands/ravenSharpLogo.png" alt="Raven Sharp"
                className="relative w-36 h-36 sm:w-52 sm:h-52 object-contain drop-shadow-[0_0_40px_rgba(124,92,191,0.5)]" />
            </div>
          </div>
          <span className="inline-block text-xs font-mono uppercase tracking-[0.3em] text-[var(--raven-glow)] border border-[var(--raven)]/40 bg-[var(--raven)]/10 px-4 py-1.5 rounded-full mb-6">
            ✦ True AI Image Upscaling + Optimisation
          </span>
          <h1 className="font-display text-5xl sm:text-7xl font-black tracking-tighter leading-[0.9] mb-6">
            Print-ready.<br/>
            <span className="bg-gradient-to-r from-[var(--raven-glow)] via-[var(--gold)] to-[var(--raven-glow)] bg-clip-text text-transparent" style={{backgroundSize:"200%",animation:"shimmer 4s linear infinite"}}>
              Platform-perfect.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
            AI upscale, crop, enhance, watermark and inject DPI metadata — everything a POD creator, photographer or digital artist needs. Batch process and export in one click.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/optimiser"
              className="flex items-center gap-2 px-10 h-14 text-base font-semibold bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-xl transition-all glow-pulse">
              Open Optimiser <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#pricing"
              className="flex items-center gap-2 px-8 h-14 text-base border border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">
              See Pricing
            </a>
          </div>
          <p className="text-xs text-[var(--subtle)] mt-6">Free to use · No account required for basic optimising</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--gold)]">What It Does</span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-2">Everything in one place.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="glass rounded-2xl p-6 group hover:border-[var(--raven)]/40 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-[var(--raven)]/15 border border-[var(--raven)]/20 flex items-center justify-center text-[var(--raven-glow)] mb-4 group-hover:bg-[var(--raven)]/25 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-display text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* vs Topaz comparison */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="glass rounded-2xl p-8 sm:p-10 text-center border border-[var(--raven)]/20">
            <span className="text-xs font-mono uppercase tracking-widest text-[var(--gold)]">vs the Competition</span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-2 mb-6">
              Why Raven Sharp beats Topaz Gigapixel for POD creators
            </h2>
            <div className="grid sm:grid-cols-2 gap-6 text-left">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--raven-glow)]">Topaz Gigapixel AI</h3>
                {["$12–17/month desktop app","Windows/Mac only — no browser","No DPI injection","No POD platform presets","No crop or watermark","No batch ZIP export"].map(i => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="text-red-400">✗</span> {i}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--raven-glow)]">Raven Sharp</h3>
                {["$10–15/month, works in browser","Same Real-ESRGAN AI engine","DPI injection (PNG + JPEG)","Gelato, Printify, Etsy, Redbubble presets","Crop + watermark built in","Batch + ZIP download"].map(i => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {i}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 sm:py-24" id="pricing">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--gold)]">Pricing</span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-2">Simple. Honest.</h2>
            <p className="text-[var(--muted)] mt-4 max-w-lg mx-auto">Process thousands of images for $15/month. Cancel anytime.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {TIERS.map(t => (
              <div key={t.name} className={`relative rounded-2xl p-7 flex flex-col ${t.featured ? "bg-gradient-to-b from-[var(--raven)]/20 to-[var(--surface)] border border-[var(--raven)]/40 shadow-[0_0_30px_rgba(124,92,191,0.1)]" : "glass"}`}>
                {t.featured && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest bg-[var(--raven)] text-white px-3 py-1 rounded-full">
                    <Star className="w-3 h-3" /> Best Value
                  </span>
                )}
                <h3 className="font-display text-xl font-bold">{t.name}</h3>
                <p className="text-xs text-[var(--muted)] mt-1 mb-3">{t.desc}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-display text-4xl font-black">${t.price}</span>
                  {t.period && <span className="text-sm text-[var(--muted)]">{t.period}</span>}
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {t.perks.map(p => (
                    <li key={p} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <Check className="w-3.5 h-3.5 text-[var(--raven-glow)] shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
                <Link to={t.price === "0" ? "/register" : `/register?tier=${t.name.toLowerCase()}`}
                  className={`w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center transition-all ${
                    t.featured ? "bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white" : "bg-white/10 hover:bg-white/15 text-white"
                  }`}>
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[var(--subtle)] mt-6">
            All prices AUD · Cancel anytime ·{" "}
            <Link to="/legal/refunds" className="text-[var(--raven-glow)] hover:underline">7-day refund policy</Link>
          </p>
        </div>
      </section>

      <ADGFooter />
    </div>
  );
}
