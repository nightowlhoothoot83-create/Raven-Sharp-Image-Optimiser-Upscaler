import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const LOGO_URL =
  "/raven-logo.png";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const res = await register(email, password, name);
    setBusy(false);
    if (!res.ok) { setError(res.error); toast.error(res.error); return; }
    toast.success("Account created");
    navigate("/");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden border-r border-raven-border">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "url('https://images.pexels.com/photos/10874546/pexels-photo-10874546.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')",
            backgroundSize: "cover", backgroundPosition: "center",
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
        <div className="relative">
          <div className="label-tiny mb-3">Built for designers, sellers, print pros</div>
          <h1 className="font-display text-5xl leading-[0.95] tracking-tight">
            Optimise once.<br />
            <span className="bg-gradient-to-r from-raven-violetBright to-raven-cyan bg-clip-text text-transparent">Print-ready forever.</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6 animate-fade-up" data-testid="signup-form">
          <div>
            <div className="label-tiny mb-2">Get started</div>
            <h2 className="font-display text-4xl tracking-tight">Create account</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-tiny block mb-2">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio name" className="input-base w-full" data-testid="signup-name-input" />
            </div>
            <div>
              <label className="label-tiny block mb-2">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className="input-base w-full" data-testid="signup-email-input" />
            </div>
            <div>
              <label className="label-tiny block mb-2">Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="input-base w-full" data-testid="signup-password-input" />
            </div>
          </div>

          {error && <div className="text-sm text-red-400" data-testid="signup-error">{error}</div>}

          <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="signup-submit-button">
            {busy ? "CREATING…" : "CREATE ACCOUNT"}
          </button>

          <div className="text-sm text-raven-muted text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-raven-violetBright hover:text-white" data-testid="login-link">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
