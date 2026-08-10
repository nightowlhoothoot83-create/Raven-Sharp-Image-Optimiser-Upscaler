import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";
import api from "../lib/api";
import ADGFooter from "../components/ADGFooter";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]         = useState({ email: "", password: "" });
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [mode, setMode]         = useState("login"); // "login" | "forgot" | "sent"
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/optimiser");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async e => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      setMode("sent");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-4xl flex flex-col gap-8 items-center">
        <aside className="glass rounded-3xl p-6 sm:p-8 overflow-hidden text-center w-full">
          <div className="relative w-52 h-52 mx-auto mb-4">
            <div className="absolute inset-5 rounded-full bg-gradient-to-br from-[var(--raven)]/35 to-[var(--raven-blue)]/25 blur-3xl" />
            <img src="/brands/ravenCentre.png" alt="Raven Sharp"
              className="relative w-52 h-52 object-contain drop-shadow-[0_0_34px_rgba(56,189,248,0.38)]" />
          </div>
          <div className="sparkle-badge mb-5">Image Optimiser &amp; Upscaler</div>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight leading-[.98]">
            Prepare better images <span className="bg-gradient-to-r from-[var(--raven-glow)] via-[var(--gold)] to-[var(--raven-blue)] bg-clip-text text-transparent" style={{backgroundSize:"200%",animation:"shimmer 4s linear infinite"}}>before you publish.</span>
          </h1>
          <p className="text-[var(--muted)] mt-5 max-w-2xl mx-auto">
            Optimise file size, upscale with AI, crop to exact ratios, remove backgrounds,
            set print-ready DPI and export complete batches from one reviewable workflow.
          </p>
          <img
            src="/product-preview.png"
            alt="Raven Sharp Optimiser showing two completed before-and-after comparisons"
            className="w-full mt-6 rounded-2xl border border-white/10 bg-black/20"
          />
          <div className="grid sm:grid-cols-2 gap-3 mt-5 text-sm text-[var(--muted)] text-left">
            <div className="rounded-xl border border-white/8 bg-white/[.03] p-3">AI upscaling and quality comparison</div>
            <div className="rounded-xl border border-white/8 bg-white/[.03] p-3">Crop, enhancement and background removal</div>
            <div className="rounded-xl border border-white/8 bg-white/[.03] p-3">Correct PNG and JPEG DPI metadata</div>
            <div className="rounded-xl border border-white/8 bg-white/[.03] p-3">Batch processing and ZIP downloads</div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-5 text-xs">
            <Link to="/#pricing" className="text-[var(--gold)] hover:text-white">Free, Standard A$10, Pro A$15</Link>
            <Link to="/legal/privacy" className="text-[var(--muted)] hover:text-white">Privacy</Link>
            <Link to="/legal/terms" className="text-[var(--muted)] hover:text-white">Terms</Link>
            <Link to="/legal/cookies" className="text-[var(--muted)] hover:text-white">Cookies</Link>
            <a href="https://raven-sharp.com" className="text-[var(--raven-glow)] hover:text-white">All Raven Sharp tools</a>
          </div>
        </aside>
      <div className="w-full max-w-md mx-auto">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/brands/ravenSharpLogo.png" alt="Raven Sharp"
            className="w-16 h-16 object-contain mx-auto mb-4 drop-shadow-[0_0_20px_rgba(124,92,191,0.4)]" />
          <h1 className="font-display text-3xl font-black">
            {mode === "login" ? "Sign in" : mode === "forgot" ? "Reset password" : "Check your email"}
          </h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            {mode === "login"  ? "Access AI upscaling and job history" :
             mode === "forgot" ? "Enter your email and we'll send a reset link" :
             "A reset link has been sent if that account exists"}
          </p>
        </div>

        <div className="glass rounded-2xl p-8">

          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
            <form onSubmit={submit} className="space-y-4">

              {/* Email */}
              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--raven)]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-[var(--raven-glow)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--raven)]/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-[var(--raven)] to-[var(--raven-blue)] hover:brightness-110 shadow-[0_4px_16px_rgba(124,92,191,0.35)] hover:shadow-[0_6px_24px_rgba(124,92,191,0.5)] text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...</>
                ) : "Sign In"}
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {mode === "forgot" && (
            <form onSubmit={submitForgot} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--raven)]/50 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full h-12 bg-gradient-to-r from-[var(--raven)] to-[var(--raven-blue)] hover:brightness-110 shadow-[0_4px_16px_rgba(124,92,191,0.35)] hover:shadow-[0_6px_24px_rgba(124,92,191,0.5)] text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {forgotLoading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...</>
                ) : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full flex items-center justify-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors pt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </form>
          )}

          {/* ── EMAIL SENT ── */}
          {mode === "sent" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm text-[var(--muted)]">
                If an account exists for <span className="text-[var(--text)] font-semibold">{forgotEmail}</span>,
                you'll receive a reset link shortly.
              </p>
              <p className="text-xs text-[var(--subtle)]">
                Check your spam folder if it doesn't arrive within a few minutes.
              </p>
              <button
                onClick={() => setMode("login")}
                className="w-full flex items-center justify-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors pt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </div>
          )}

          {/* Register link */}
          {mode === "login" && (
            <p className="text-center text-xs text-[var(--muted)] mt-5">
              No account?{" "}
              <Link to="/register" className="text-[var(--raven-glow)] hover:underline">
                Create one free
              </Link>
            </p>
          )}
        </div>
      </div></div></div>
      <ADGFooter />
    </div>
  );
}
