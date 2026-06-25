import React from "react";
import { Link, useParams } from "react-router-dom";
import ADGFooter from "../components/ADGFooter";
const PAGES = {
  privacy:{title:"Privacy Policy",updated:"May 2026",body:"Raven Sharp Image Optimiser (Ascension Digital Group) collects your email, name, password hash and job processing history to provide and improve the service. We use Replicate for AI upscaling, Stripe for billing, and MongoDB for data storage. We do not sell your personal information. Platform API keys are stored encrypted. You have the right to access, correct and delete your data at any time by contacting ascensiondigitalagency@outlook.com. This policy is governed by the Australian Privacy Act 1988 (Cth) and the GDPR where applicable."},
  terms:{title:"Terms of Service",updated:"May 2026",body:"By using Raven Sharp Image Optimiser you agree to these terms. You retain all intellectual property rights to images you upload and process. Subscriptions auto-renew monthly; cancel any time from your account. We limit liability to amounts paid in the prior 3 months. The service is provided as-is. These terms are governed by the laws of Queensland, Australia."},
  refunds:{title:"Refund Policy",updated:"May 2026",body:"We offer a 7-day refund on new subscriptions if you are unsatisfied. After 7 days, subscriptions are non-refundable on cancellation — access continues to end of billing period. Annual plans may be refunded on a pro-rata basis within 14 days if the service has not been substantially used. Contact ascensiondigitalagency@outlook.com to request a refund."},
  cookies:{title:"Cookie Policy",updated:"May 2026",body:"Raven Sharp uses only two cookies: access_token and refresh_token, both httpOnly and secure. These are strictly necessary for authentication and cannot be disabled without preventing login. We do not use advertising, analytics, or tracking cookies."},
  "acceptable-use":{title:"Acceptable Use Policy",updated:"May 2026",body:"You may not use Raven Sharp to process content that infringes third-party intellectual property, contains illegal material, is sexually explicit, or violates applicable laws. We reserve the right to suspend accounts that violate this policy. By uploading images you confirm you have the right to do so."},
};
export default function Legal() {
  const {page} = useParams();
  const legal = PAGES[page];
  if(!legal) return <div className="min-h-screen pt-20 flex items-center justify-center"><p className="text-[var(--muted)]">Page not found.</p></div>;
  return (<div className="min-h-screen pt-20 pb-16">
    <div className="max-w-2xl mx-auto px-4 sm:px-6">
      <span className="text-xs font-mono uppercase tracking-widest text-[var(--gold)]">Legal</span>
      <h1 className="font-display text-4xl font-black tracking-tighter mt-1 mb-2">{legal.title}</h1>
      <p className="text-xs text-[var(--muted)] mb-8">Last updated: {legal.updated}</p>
      <div className="glass rounded-2xl p-8 mb-6">
        <p className="text-sm text-[var(--muted)] leading-relaxed">{legal.body}</p>
        <p className="text-xs text-[var(--subtle)] mt-6">Contact: <a href="mailto:ascensiondigitalagency@outlook.com" className="text-[var(--raven-glow)] hover:underline">ascensiondigitalagency@outlook.com</a> · Ascension Digital Group · Queensland, Australia</p>
      </div>
      <div className="flex flex-wrap gap-2">{Object.entries(PAGES).map(([slug,p])=>(
        <Link key={slug} to={`/legal/${slug}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${slug===page?"bg-[var(--raven)]/20 text-[var(--raven-glow)] border border-[var(--raven)]/30":"text-[var(--muted)] bg-white/5 border border-white/10 hover:bg-white/10"}`}>{p.title}</Link>))}</div>
    </div><ADGFooter/></div>);}
