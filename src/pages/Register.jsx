import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
export default function Register() {
  const { register } = useAuth(); const navigate = useNavigate();
  const [form, setForm] = useState({name:"",email:"",password:"",confirm:""}); const [loading, setLoading] = useState(false);
  const submit = async e => { e.preventDefault();
    if(form.password!==form.confirm){toast.error("Passwords don't match");return;}
    setLoading(true);
    try { await register(form.email,form.password,form.name); navigate("/optimiser"); toast.success("Welcome!"); }
    catch(err) { toast.error(err.response?.data?.detail||"Registration failed"); }
    finally { setLoading(false); }};
  return (<div className="min-h-screen flex items-center justify-center px-4 py-16">
    <div className="w-full max-w-md">
      <div className="text-center mb-8"><img src="/brands/ravenSharpLogo.png" alt="Raven Sharp" className="w-16 h-16 object-contain mx-auto mb-4 drop-shadow-[0_0_20px_rgba(124,92,191,0.4)]"/>
        <h1 className="font-display text-3xl font-black">Create account</h1><p className="text-[var(--muted)] text-sm mt-1">Free — no credit card needed</p></div>
      <div className="glass rounded-2xl p-8">
        <form onSubmit={submit} className="space-y-4">
          {[{k:"name",l:"Name",t:"text",p:"Your name"},{k:"email",l:"Email",t:"email",p:"you@example.com"},{k:"password",l:"Password",t:"password",p:"Min 8 chars"},{k:"confirm",l:"Confirm Password",t:"password",p:"••••••••"}].map(f=>(
            <div key={f.k}><label className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] block mb-2">{f.l}</label>
              <input type={f.t} value={form[f.k]} onChange={e=>setForm(v=>({...v,[f.k]:e.target.value}))} required placeholder={f.p}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--raven)]/50"/></div>))}
          <button type="submit" disabled={loading} className="w-full h-12 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 glow-pulse">
            {loading?"Creating...":"Create Free Account"}</button></form>
        <p className="text-center text-[10px] text-[var(--subtle)] mt-4">
          By signing up you agree to our <Link to="/legal/terms" className="text-[var(--raven-glow)] hover:underline">Terms</Link> and <Link to="/legal/privacy" className="text-[var(--raven-glow)] hover:underline">Privacy Policy</Link></p>
      </div></div></div>);}
