import React, { useState, useEffect, useCallback } from "react";
import { 
  Activity, Database, Zap, CreditCard, Brain, 
  RefreshCw, CheckCircle, XCircle, AlertCircle,
  Users, Image, TrendingUp, Clock
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const STATUS_CONFIG = {
  ok:             { icon: CheckCircle,  color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/25", label: "Operational" },
  error:          { icon: XCircle,      color: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/25",     label: "Error" },
  degraded:       { icon: AlertCircle,  color: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/25",   label: "Degraded" },
  not_configured: { icon: AlertCircle,  color: "text-[var(--muted)]", bg: "bg-white/5",     border: "border-white/10",       label: "Not configured" },
};

const SERVICE_META = {
  mongodb:    { label: "MongoDB Atlas",  icon: Database },
  replicate:  { label: "Replicate AI",   icon: Zap },
  stripe:     { label: "Stripe Billing", icon: CreditCard },
  claude:     { label: "Claude Vision",  icon: Brain },
  gemini:     { label: "Gemini Image",   icon: Image },
  r2_storage: { label: "R2 Storage",     icon: Database },
};

function ServiceCard({ name, data }) {
  const status = data?.status || "error";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;
  const meta = SERVICE_META[name] || { label: name, icon: Activity };
  const Icon = meta.icon;
  const StatusIcon = cfg.icon;

  return (
    <div className={`rounded-xl p-4 border ${cfg.bg} ${cfg.border} flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text)]">{meta.label}</div>
        {data?.detail && (
          <div className="text-xs text-red-400 truncate mt-0.5">{data.detail}</div>
        )}
        {data?.code && data.code !== 200 && (
          <div className="text-xs text-amber-400 mt-0.5">HTTP {data.code}</div>
        )}
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
        <StatusIcon className="w-3.5 h-3.5" />
        {cfg.label}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "text-[var(--raven-glow)]" }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">{label}</span>
      </div>
      <div className={`text-2xl font-display font-black ${color}`}>
        {value ?? <span className="text-[var(--subtle)] text-lg">—</span>}
      </div>
    </div>
  );
}

export default function HealthMonitor() {
  const { user } = useAuth();
  const [health, setHealth]       = useState(null);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.allSettled([
        api.get("/health/detailed"),
        api.get("/health/stats"),
      ]);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value.data);
      if (statsRes.status === "fulfilled")  setStats(statsRes.value.data);
      setLastChecked(new Date());
    } catch (e) {
      console.error("Health check failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, check]);

  if (user?.tier !== "owner") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-[var(--muted)] mx-auto mb-3" />
          <p className="text-[var(--muted)]">Owner access required</p>
        </div>
      </div>
    );
  }

  const overallStatus = health?.status || "error";
  const overallCfg = STATUS_CONFIG[overallStatus] || STATUS_CONFIG.error;
  const OverallIcon = overallCfg.icon;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl font-black flex items-center gap-3">
              <Activity className="w-8 h-8 text-[var(--raven-glow)]" />
              System Monitor
            </h1>
            {lastChecked && (
              <p className="text-xs text-[var(--muted)] mt-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                autoRefresh
                  ? "bg-[var(--raven)]/20 text-[var(--raven-glow)] border-[var(--raven)]/30"
                  : "bg-white/5 text-[var(--muted)] border-white/10 hover:bg-white/10"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-[var(--muted)]"}`} />
              Auto (30s)
            </button>

            <button onClick={check} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--raven)] hover:bg-[var(--raven-glow)] text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Checking…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Overall status banner */}
        {health && (
          <div className={`rounded-2xl p-5 border mb-6 flex items-center gap-4 ${overallCfg.bg} ${overallCfg.border}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${overallCfg.bg}`}>
              <OverallIcon className={`w-6 h-6 ${overallCfg.color}`} />
            </div>
            <div>
              <div className={`font-display text-lg font-black ${overallCfg.color}`}>
                {overallStatus === "ok" ? "All Systems Operational" : "System Issues Detected"}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {Object.values(health.services || {}).filter(s => s.status === "ok").length} of{" "}
                {Object.keys(health.services || {}).length} services healthy
              </div>
            </div>
          </div>
        )}

        {/* Service cards */}
        {health?.services && (
          <div className="space-y-3 mb-8">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
              Service Status
            </h2>
            {Object.entries(health.services).map(([name, data]) => (
              <ServiceCard key={name} name={name} data={data} />
            ))}
          </div>
        )}

        {/* Usage stats */}
        {stats && (
          <>
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-3">
              Usage Statistics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Total Users" value={stats.total_users} icon={Users} />
              <StatCard label="Total Jobs" value={stats.total_jobs || stats.total_pipeline_runs} icon={TrendingUp} />
              <StatCard label="Today" value={stats.jobs_today || stats.runs_today} icon={Activity} color="text-emerald-400" />
              <StatCard
                label="Free Users"
                value={stats.users_by_tier?.free ?? "—"}
                icon={Users}
                color="text-[var(--muted)]"
              />
            </div>

            {/* Tier breakdown */}
            {stats.users_by_tier && Object.keys(stats.users_by_tier).length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-4">
                  Users by Tier
                </h3>
                <div className="space-y-2">
                  {Object.entries(stats.users_by_tier).map(([tier, count]) => (
                    <div key={tier} className="flex items-center gap-3">
                      <span className="text-sm font-semibold capitalize w-20 text-[var(--text)]">{tier}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--raven)] rounded-full transition-all"
                          style={{ width: `${Math.min(100, (count / (stats.total_users || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--muted)] w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading state */}
        {!health && loading && (
          <div className="text-center py-16">
            <RefreshCw className="w-8 h-8 text-[var(--raven-glow)] animate-spin mx-auto mb-3" />
            <p className="text-sm text-[var(--muted)]">Running health checks…</p>
          </div>
        )}

      </div>
    </div>
  );
}
