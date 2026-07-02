import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const LOGO_URL =
  "/raven-logo.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) { setError(res.error); toast.error(res.error); return; }
    toast.success("Signed in");
    navigate("/");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-raven-border">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "url('https://images.pexels.com/photos/10874546/pexels-photo-10874546.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(0.8)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-raven-bg via-transparent to-raven-bg/90" />
        <div className="relative">
          <img
            src={LOGO_URL}
            alt="Raven Sharp"
            className="h-32 w-auto object-contain logo-plate"
          />
        </div>
        <div className="relative max-w-md">
          <div className="label-tiny mb-3">Print-grade Image Optimiser</div>
          <h1 className="font-display text-5xl leading-[0.95] tracking-tight">
            Sharpen.<br />
            Resize.<br />
            <span className="bg-gradient-to-r from-raven-violetBright to-raven-cyan bg-clip-text text-transparent">Ship at 300 DPI.</span>
          </h1>
          <p className="text-raven-muted mt-6 text-sm">
            100% local processing in your browser. Your images never leave your machine.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6 animate-fade-up" data-testid="login-form">
          <div>
            <div className="label-tiny mb-2">Welcome back</div>
            <h2 className="font-display text-4xl tracking-tight">Sign in</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-tiny block mb-2">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                className="input-base w-full"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="label-tiny block mb-2">Password</label>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base w-full"
                data-testid="login-password-input"
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-400" data-testid="login-error">{error}</div>}

          <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="login-submit-button">
            {busy ? "SIGNING IN…" : "SIGN IN"}
          </button>

          <div className="text-sm text-raven-muted text-center">
            No account?{" "}
            <Link to="/signup" className="text-raven-violetBright hover:text-white" data-testid="signup-link">Create one</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
