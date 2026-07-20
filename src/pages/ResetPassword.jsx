import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react";
import api from "../lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [valid, setValid]       = useState(null); // null=checking, true=valid, false=invalid
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    if (!token) { setValid(false); return; }
    api.get(`/auth/verify-reset-token/${token}`)
      .then(r => { setValid(true); setEmail(r.data.email); })
      .catch(() => setValid(false));
  }, [token]);

  const submit = async e => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 8)  { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reset failed — link may have expired");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/brands/ravenSharpLogo.png" alt="Raven Sharp"
            className="w-16 h-16 object-contain mx-auto mb-4 drop-shadow-[0_0_20px_rgba(124,92,191,0.4)]" />
          <h1 className="font-display text-3xl font-black">
            {done ? "Password reset" : "Set new password"}
          </h1>
        </div>

        <div className="glass rounded-2xl p-8">

          {/* Checking token */}
          {valid === null && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[var(--raven-glow)] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[var(--muted)]">Verifying reset link…</p>
            </div>
          )}

          {/* Invalid token */}
          {valid === false && (
            <div className="text-center space-y-4">
              <p className="text-sm text-red-400">
                This reset link is invalid or has expired.
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-2 text-xs text-[var(--raven-glow)] hover:underline">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm text-[var(--muted)]">
                Your password has been reset. Redirecting to sign in…
              </p>
            </div>
          )}

          {/* Reset form */}
          {valid === true && !done && (
            <form onSubmit={submit} className="space-y-4">
              {email && (
                <p className="text-xs text-[var(--muted)] text-center -mt-1 mb-4">
                  Resetting password for <span className="text-[var(--text)]">{email}</span>
                </p>
              )}

              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required minLength={8}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--raven)]/50 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`w-full bg-white/5 border rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text)] outline-none transition-colors ${
                      confirm && confirm !== password
                        ? "border-red-500/50 focus:border-red-500/70"
                        : "border-white/10 focus:border-[var(--raven)]/50"
                    }`}
                  />
                </div>
                {confirm && confirm !== password && (
                  <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                )}
              </div>

              <button type="submit" disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-[var(--raven)] to-[var(--raven-blue)] hover:brightness-110 shadow-[0_4px_16px_rgba(124,92,191,0.35)] hover:shadow-[0_6px_24px_rgba(124,92,191,0.5)] text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Resetting...</>
                ) : "Set New Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
