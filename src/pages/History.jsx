import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import ADGFooter from "../components/ADGFooter";
import { Clock, Trash2, Image } from "lucide-react";
import { toast } from "sonner";
const fmt = b => b>=1048576?(b/1048576).toFixed(1)+" MB":(b/1024).toFixed(0)+" KB";
export default function History() {
  const [jobs,setJobs] = useState([]); const [loading,setLoading] = useState(true);
  useEffect(()=>{api.get("/jobs").then(({data})=>setJobs(data)).catch(()=>{}).finally(()=>setLoading(false));},[]);
  const del = async id => { await api.delete(`/jobs/${id}`); setJobs(p=>p.filter(j=>j.id!==id)); toast.success("Removed"); };
  const delAll = async () => { await api.delete("/jobs"); setJobs([]); toast.success("Cleared"); };
  return (<div className="min-h-screen pt-20 pb-16">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div><span className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--gold)]">Processing History</span>
          <h1 className="font-display text-4xl font-black tracking-tighter mt-1">Job History</h1></div>
        {jobs.length>0&&<button onClick={delAll} className="text-xs text-red-400 hover:underline">Clear all</button>}
      </div>
      {loading?<div className="text-center py-16 text-[var(--muted)]">Loading…</div>
      :jobs.length===0?<div className="text-center py-20"><Clock className="w-12 h-12 text-[var(--raven)]/30 mx-auto mb-4"/><p className="text-[var(--muted)]">No jobs yet.</p></div>
      :<div className="glass rounded-2xl overflow-hidden"><div className="divide-y divide-white/5">
        {jobs.map(job=>(
          <div key={job.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[var(--raven)]/15 border border-[var(--raven)]/20 flex items-center justify-center text-[var(--raven-glow)] shrink-0"><Image className="w-5 h-5"/></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{job.name}</p>
              <p className="text-xs text-[var(--muted)]">{job.width}×{job.height}px · {job.dpi}dpi · {job.format?.toUpperCase()} · {fmt(job.original_size)} → {fmt(job.output_size)}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-[var(--subtle)]">{new Date(job.created_at).toLocaleDateString("en-AU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
              <button onClick={()=>del(job.id)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 text-[var(--subtle)] hover:text-red-400 transition-all flex items-center justify-center"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          </div>))}
      </div></div>}
    </div><ADGFooter/></div>);}
