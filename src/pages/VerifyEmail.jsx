import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import api from "../lib/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("checking"); // checking | success | failed

  useEffect(() => {
    if (!token) { setStatus("failed"); return; }
    api.get(`/auth/verify-email/${token}`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("failed"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/brands/ravenSharpLogo.png" alt="Raven Sharp"
            className="w-16 h-16 object-contain mx-auto mb-4 drop-shadow-[0_0_20px_rgba(124,92,191,0.4)]" />
          <h1 className="font-display text-3xl font-black">Email verification</h1>
        </div>

        <div className="glass rounded-2xl p-8">
          {status === "checking" && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[var(--raven-glow)] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[var(--muted)]">Verifying your email…</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm text-[var(--muted)]">
                Your email's verified — you're all set to start processing images.
              </p>
              <Link to="/optimiser"
                className="inline-flex items-center justify-center w-full h-12 bg-gradient-to-r from-[var(--raven)] to-[var(--raven-blue)] hover:brightness-110 shadow-[0_4px_16px_rgba(124,92,191,0.35)] hover:shadow-[0_6px_24px_rgba(124,92,191,0.5)] text-white rounded-xl font-semibold text-sm transition-all">
                Go to Image Optimiser
              </Link>
            </div>
          )}

          {status === "failed" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>
              <p className="text-sm text-red-400">
                This verification link is invalid or has already been used.
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-2 text-xs text-[var(--raven-glow)] hover:underline">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
