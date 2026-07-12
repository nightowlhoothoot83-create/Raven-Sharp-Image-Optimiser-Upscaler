import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Activity, Wand2, Clock, Settings, LogOut, ChevronDown, Menu, X } from "lucide-react";

export default function TopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const isActive = p => location.pathname === p;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[var(--bg)]/95 backdrop-blur-xl border-b border-white/8" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/brands/ravenSharpLogo.png" alt="Raven Sharp"
              className="w-9 h-9 object-contain group-hover:scale-105 transition-transform drop-shadow-[0_0_8px_rgba(124,92,191,0.4)]" />
            <div className="hidden sm:block">
              <div className="font-display text-lg font-black tracking-tight leading-none">
                RAVEN <span className="text-[var(--raven-glow)]">SHARP</span>
              </div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[var(--subtle)]">Image Optimiser</div>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { to:"/optimiser", icon:<Wand2 className="w-4 h-4"/>, label:"Optimiser" },
              { to:"/history",   icon:<Clock className="w-4 h-4"/>, label:"History",  auth:true },
            ].filter(l => !l.auth || user).map(link => (
              <Link key={link.to} to={link.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? "bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30"
                    : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5"
                }`}>
                {link.icon} {link.label}
              </Link>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button onClick={() => setUserMenu(!userMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                  <div className="w-7 h-7 rounded-full bg-[var(--raven)]/30 border border-[var(--raven)]/40 flex items-center justify-center text-xs font-bold text-[var(--raven-glow)]">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-xs font-medium">{user.name?.split(" ")[0]}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform ${userMenu?"rotate-180":""}`} />
                </button>
                {userMenu && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-[var(--surface)] border border-white/10 shadow-2xl overflow-hidden z-50">
                    {user?.tier === "owner" && (
                      <Link to="/health" onClick={() => setUserMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/5 text-sm text-emerald-400 transition-colors">
                        <Activity className="w-4 h-4" /> System Monitor
                      </Link>
                    )}
                    <Link to="/account" onClick={() => setUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)] transition-colors">
                      <Settings className="w-4 h-4" /> Account
                    </Link>
                    <div className="border-t border-white/5" />
                    <button onClick={async () => { await logout(); navigate("/"); setUserMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors">Sign In</Link>
                <Link to="/register" className="px-4 py-2 text-sm font-semibold bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-lg transition-all">Free Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
