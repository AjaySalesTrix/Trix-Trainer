"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminPosthog from "./AdminPosthog";
import "../../admin.css";

type CallEvent = {
  id: string;
  created_at: string;
  phase: string | null;
  reason: string | null;
  node_id: string | null;
  note: string | null;
  path: unknown;
  email: string | null;
  name: string | null;
};

type ProblemRow = {
  root_cause: string | null;
  symptom: string | null;
  updated_at: string | null;
};

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function mostCommon(list: string[]) {
  if (!list.length) return "-";
  const counts = new Map<string, number>();
  list.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
}

function formatPath(path: unknown) {
  if (!path) return "-";
  if (Array.isArray(path)) {
    return path
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "id" in item) {
          return String((item as { id: string }).id);
        }
        return "";
      })
      .filter(Boolean)
      .join(" -> ");
  }
  return "-";
}

function formatShort(dateStr?: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: Promise<{ embed?: string }>;
}) {
  const sp = await searchParams;
  const embed = sp?.embed === "1";
  const { userId } = await auth();
  const adminId = process.env.ADMIN_CLERK_USER_ID;
  if (!userId || !adminId || userId !== adminId) {
    notFound();
  }
  if (!embed) {
    redirect(`/trainer?mode=dashboard&userId=${encodeURIComponent(params.userId)}`);
  }

  const supabase = getSupabase();
  if (!supabase) {
    notFound();
  }

  const targetUserId = params.userId;
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: statsEvents } = await supabase
    .from("call_ended_events")
    .select("phase, reason, node_id, created_at")
    .eq("user_id", targetUserId)
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(1000);

  const { data: recentEvents } = await supabase
    .from("call_ended_events")
    .select("id, created_at, phase, reason, node_id, note, path, email, name")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: problemRows } = await supabase
    .from("problem_lab_rows")
    .select("root_cause, symptom, updated_at")
    .eq("user_id", targetUserId)
    .order("updated_at", { ascending: false })
    .limit(10);

  const reasons = (statsEvents || []).map((row) => row.reason || "-");
  const phases = (statsEvents || []).map((row) => row.phase || "-");
  const nodes = (statsEvents || [])
    .map((row) => row.node_id || "-")
    .filter(Boolean);

  const breakdown = {
    phase1: phases.filter((p) => p === "phase1").length,
    phase2: phases.filter((p) => p === "phase2").length,
    phase2_preview: phases.filter((p) => p === "phase2_preview").length,
  };

  const lastSeen = recentEvents?.[0]?.created_at;
  const displayName = recentEvents?.[0]?.name || "Unknown user";
  const displayEmail = recentEvents?.[0]?.email || "No email";
  const callsEnded30 = statsEvents?.length || 0;
  const rootCause = problemRows?.[0]?.root_cause || "-";
  const symptoms = (problemRows || [])
    .map((row) => row.symptom)
    .filter(Boolean) as string[];

  return (
    <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-logo">TRIX</div>
            <div className="admin-brand-sub">Coaching Console</div>
          </div>
          <nav className="admin-nav">
            <Link className="admin-nav-item" href="/admin?embed=1">
              Dashboard
            </Link>
            <Link className="admin-nav-item" href="/admin?embed=1#users">
              Users
            </Link>
          </nav>
        </aside>

      <main className="admin-main">
        <AdminPosthog userId={targetUserId} />
        <div className="admin-topbar">
          <div>
            <Link className="admin-back" href="/admin?embed=1">
              Back to dashboard
            </Link>
            <h1 className="admin-title">User detail</h1>
            <p className="admin-subtitle">Coaching signal from the last 30 days.</p>
          </div>
        </div>

          <section className="admin-card admin-user-summary">
            <div>
              <p className="admin-user-name">{displayName}</p>
              <p className="admin-user-email">{displayEmail}</p>
            </div>
            <div className="admin-user-meta">
              <span>Last seen: {formatShort(lastSeen)}</span>
              <span>Calls ended (30d): {callsEnded30}</span>
              <span>User ID: {targetUserId}</span>
            </div>
          </section>

          <section className="admin-split-grid">
            <div className="admin-card">
              <p className="admin-metric-label">Top failure reason</p>
              <p className="admin-metric-value">{mostCommon(reasons)}</p>
            </div>
            <div className="admin-card">
              <p className="admin-metric-label">Top failure node</p>
              <p className="admin-metric-value">{mostCommon(nodes)}</p>
            </div>
            <div className="admin-card">
              <p className="admin-metric-label">Phase breakdown</p>
              <p className="admin-metric-value">
                P1 {breakdown.phase1} {"->"} P2 {breakdown.phase2} {"->"} Preview{" "}
                {breakdown.phase2_preview}
              </p>
            </div>
          </section>

          <section className="admin-card">
            <h3 className="admin-card-title">Problem Lab snapshot</h3>
            <p className="admin-muted">Latest root cause</p>
            <p className="admin-root-cause">{rootCause}</p>
            <div className="admin-symptom-list">
              {symptoms.map((symptom, idx) => (
                <span key={`${symptom}-${idx}`} className="admin-pill">
                  {symptom}
                </span>
              ))}
              {!symptoms.length && (
                <span className="admin-empty">No Problem Lab rows yet.</span>
              )}
            </div>
          </section>

          <section className="admin-card">
            <h3 className="admin-card-title">Recent events</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Phase</th>
                    <th>Node</th>
                    <th>Reason</th>
                    <th>Note</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentEvents || []).map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.created_at).toLocaleString()}</td>
                      <td>{event.phase || "-"}</td>
                      <td>{event.node_id || "-"}</td>
                      <td>{event.reason || "-"}</td>
                      <td>{event.note || "-"}</td>
                      <td>
                        <details className="admin-path">
                          <summary>View</summary>
                          <div>{formatPath(event.path)}</div>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {!recentEvents?.length && (
                    <tr>
                      <td colSpan={6}>No events found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
    </div>
  );
}
