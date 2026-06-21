import React from "react";
import { Link } from "react-router-dom";

const BRANDS = [
  { name:"Mystical Moments",  logo:"/brands/mysticalMoments.png",  url:"https://mystical-moments.net" },
  { name:"Zyia Creations",    logo:"/brands/zyiaCreations.png",     url:"https://www.etsy.com/shop/ZyiaCreations" },
  { name:"Spew Crew Kids",    logo:"/brands/spewCrew.png",          url:"https://youtube.com/@spewcrewkids" },
  { name:"Feed The Feed",     logo:"/brands/feedTheFeed.png",       url:"https://www.facebook.com/feedthefeed" },
  { name:"MyCalcTools",       logo:"/brands/myCalTools.png",        url:"https://mycalctools.net" },
  { name:"MyCalendarTools",   logo:"/brands/myCalendarTools.png",   url:"https://mycalendartools.net" },
  { name:"ADG Hub",           logo:"/brands/ascensionDigital.png",  url:"https://ascensiondigitalgroup.com" },
];

export default function ADGFooter() {
  return (
    <footer className="mt-20 border-t border-white/8 bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="flex flex-col items-center mb-8">
          <a href="https://ascensiondigitalgroup.com" target="_blank" rel="noreferrer">
            <img src="/brands/ascensionDigital.png" alt="Ascension Digital Group"
              className="h-9 object-contain mb-2 opacity-80 hover:opacity-100 transition-opacity" />
          </a>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--subtle)]">
            Elevating Your Digital Future
          </p>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-6 mb-8">
          {BRANDS.map(b => (
            <a key={b.name} href={b.url} target="_blank" rel="noreferrer"
              className="flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 transition-all group"
              title={b.name}>
              <img src={b.logo} alt={b.name}
                className="h-9 w-9 object-contain rounded-lg group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--subtle)]">
                {b.name}
              </span>
            </a>
          ))}
        </div>
        <div className="border-t border-white/5 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--subtle)]">
          <div className="flex items-center gap-2">
            <img src="/brands/ravenSharpLogo.png" alt="Raven Sharp"
              className="h-5 w-5 object-contain opacity-50" />
            <span>Raven Sharp Image Optimiser · Part of <a href="https://ascensiondigitalgroup.com"
              target="_blank" rel="noreferrer"
              className="hover:text-[var(--muted)] transition-colors underline">
              Ascension Digital Group
            </a></span>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <Link to="/legal/privacy" className="hover:text-[var(--muted)] transition-colors">Privacy</Link>
            <span>·</span>
            <Link to="/legal/terms" className="hover:text-[var(--muted)] transition-colors">Terms</Link>
            <span>·</span>
            <Link to="/legal/refunds" className="hover:text-[var(--muted)] transition-colors">Refunds</Link>
            <span>·</span>
            <span>© {new Date().getFullYear()} Ascension Digital Group · Queensland, Australia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
