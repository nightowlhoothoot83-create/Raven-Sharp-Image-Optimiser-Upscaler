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
          <a href="https://ascensiondigitalgroup.com" target="_blank" rel="noopener noreferrer" aria-label="Ascension Digital Group website (opens in new tab)">
            <img src="/brands/ascensionDigital.png" alt="Ascension Digital Group"
              className="h-9 object-contain mb-2 opacity-80 hover:opacity-100 transition-opacity" />
          </a>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--subtle)]">
            Elevating Your Digital Future
          </p>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-6 mb-8">
          {BRANDS.map(b => (
            <a key={b.name} href={b.url} target="_blank" rel="noopener noreferrer"
              aria-label={`${b.name} (opens in new tab)`}
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
        {/* Site navigation — second way to reach pages (WCAG 2.4.5 Level AA) */}
        <div className="border-t border-white/5 pt-6 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <h3 className="font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Tools</h3>
            <ul className="space-y-1.5">
              <li><Link to="/optimiser" className="text-[var(--subtle)] hover:text-[var(--text)] transition-colors">Optimiser</Link></li>
              <li><Link to="/history" className="text-[var(--subtle)] hover:text-[var(--text)] transition-colors">Job History</Link></li>
              <li><a href="#pricing" className="text-[var(--subtle)] hover:text-[var(--text)] transition-colors">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Account</h3>
            <ul className="space-y-1.5">
              <li><Link to="/login" className="text-[var(--subtle)] hover:text-[var(--text)] transition-colors">Sign In</Link></li>
              <li><Link to="/register" className="text-[var(--subtle)] 