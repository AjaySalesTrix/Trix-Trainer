"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import "./admin.css";

type EventRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  phase: string | null;
  reason: string | null;
  node_id: string | null;
  note: string | null;
  created_at: string;
};

type FeedbackRow = {
  hardest_part: string | null;
  created_at: string;
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

function formatShort(dateStr?: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; embed?: string }>;
}) {
  const sp = await searchParams;
  const { userId } = await auth();
  const adminId = process.env.ADMIN_CLERK_USER_ID;
  if (!userId || !adminId || userId !== adminId) {
    notFound();
  }
  const embed = sp?.embed === "1";
  if (!embed) {
    redirect("/trainer?mode=dashboard");
  }

  const supabase = getSupabase();
  if (!supabase) {
    notFound();
  }

  const email = (sp?.email || "").trim();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events30 } = await supabase
    .from("call_ended_events")
    .select("user_id, reason, phase, node_id, note, created_at")
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(4000);

  const { data: events7 } = await supabase
    .from("call_ended_events")
    .select("user_id, created_at")
    .gte("created_at", since7)
    .order("created_at", { ascending: false })
    .limit(4000);

  const { data: problemRows } = await supabase
    .from("problem_lab_rows")
    .select("user_id, root_cause, created_at")
    .gte("created_at", since30)
    .order("created_at", { ascending: false })
    .limit(4000);

  let feedbackRows: FeedbackRow[] | null = null;
  try {
    const { data, error } = await supabase
      .from("trix_feedback")
      .select("hardest_part, created_at")
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (!error) feedbackRows = data || [];
  } catch (_) {
    feedbackRows = null;
  }

  const eventRows = events30 || [];
  const totalEvents = eventRows.length;
  const notesWith = eventRows.filter((row) => row.note && row.note.trim()).length;
  const notesRate = totalEvents ? Math.round((notesWith / totalEvents) * 100) : 0;

  const noteBuckets = new Map<string, number>();
  noteBuckets.set("0", 0);
  noteBuckets.set("1-30", 0);
  noteBuckets.set("31-120", 0);
  noteBuckets.set("120+", 0);
  eventRows.forEach((row) => {
    const len = (row.note || "").trim().length;
    const key =
      len === 0 ? "0" : len <= 30 ? "1-30" : len <= 120 ? "31-120" : "120+";
    noteBuckets.set(key, (noteBuckets.get(key) || 0) + 1);
  });
  const topNoteBucket = mostCommon(
    [...noteBuckets.entries()].flatMap(([bucket, count]) =>
      count ? Array(count).fill(bucket) : []
    )
  );

  const reasonCounts = new Map<string, number>();
  eventRows.forEach((row) => {
    const reason = row.reason || "unknown";
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });
  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => ({
      reason,
      count,
      pct: totalEvents ? Math.round((count / totalEvents) * 100) : 0,
    }));

  const phases = eventRows.map((row) => row.phase || "unknown");
  const phaseCounts = {
    phase1: phases.filter((p) => p === "phase1").length,
    phase2: phases.filter((p) => p === "phase2").length,
    phase2_preview: phases.filter((p) => p === "phase2_preview").length,
  };

  const nodeCounts = new Map<string, number>();
  eventRows.forEach((row) => {
    if (!row.node_id) return;
    nodeCounts.set(row.node_id, (nodeCounts.get(row.node_id) || 0) + 1);
  });
  const topNodes = [...nodeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const activeUsers7 = new Set((events7 || []).map((row) => row.user_id)).size;

  const problemLabUsers = new Set((problemRows || []).map((row) => row.user_id)).size;
  const problemLabRows = (problemRows || []).length;
  const rootCauseCounts = new Map<string, number>();
  (problemRows || []).forEach((row) => {
    const root = (row.root_cause || "").trim();
    if (!root) return;
    rootCauseCounts.set(root, (rootCauseCounts.get(root) || 0) + 1);
  });
  const topRootCauses = [...rootCauseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([root, count]) => ({
      root,
      count,
    }));

  const totalPhase =
    phaseCounts.phase1 + phaseCounts.phase2 + phaseCounts.phase2_preview;
  const phase1Pct = totalPhase
    ? Math.round((phaseCounts.phase1 / totalPhase) * 100)
    : 0;
  const phase2Pct = totalPhase
    ? Math.round((phaseCounts.phase2 / totalPhase) * 100)
    : 0;
  const phase2PreviewPct = totalPhase
    ? Math.max(0, 100 - phase1Pct - phase2Pct)
    : 0;

  let searchEvents: EventRow[] = [];
  if (email) {
    const { data } = await supabase
      .from("call_ended_events")
      .select("user_id, email, name, reason, phase, node_id, note, created_at")
      .gte("created_at", since30)
      .ilike("email", `%${email}%`)
      .order("created_at", { ascending: false })
      .limit(500);
    searchEvents = data || [];
  }

  const userMap = new Map<
    string,
    {
      userId: string;
      name: string | null;
      email: string | null;
      lastSeen: string;
      count: number;
      reasonCounts: Map<string, number>;
      nodeIds: Set<string>;
    }
  >();

  searchEvents.forEach((row) => {
    const existing = userMap.get(row.user_id) || {
      userId: row.user_id,
      name: row.name || null,
      email: row.email || null,
      lastSeen: row.created_at,
      count: 0,
      reasonCounts: new Map<string, number>(),
      nodeIds: new Set<string>(),
    };
    existing.count += 1;
    if (row.created_at > existing.lastSeen) existing.lastSeen = row.created_at;
    if (!existing.name && row.name) existing.name = row.name;
    if (!existing.email && row.email) existing.email = row.email;
    const reason = row.reason || "unknown";
    existing.reasonCounts.set(reason, (existing.reasonCounts.get(reason) || 0) + 1);
    if (row.node_id) existing.nodeIds.add(row.node_id);
    userMap.set(row.user_id, existing);
  });

  const userCards = Array.from(userMap.values()).map((user) => {
    const topUserReason =
      [...user.reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "-";
    return {
      ...user,
      topUserReason,
      varietyScore: user.nodeIds.size,
    };
  });

  const feedbackCounts = new Map<string, number>();
  (feedbackRows || []).forEach((row) => {
    const key = row.hardest_part || "unknown";
    feedbackCounts.set(key, (feedbackCounts.get(key) || 0) + 1);
  });
  const topFeedback = [...feedbackCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo">TRIX</div>
          <div className="admin-brand-sub">Coaching Console</div>
        </div>
        <nav className="admin-nav">
          <div className="admin-nav-item active">Dashboard</div>
          <a className="admin-nav-item" href="#users">
            Users
          </a>
        </nav>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <div className="admin-kicker">Coaching Intelligence - last 30 days</div>
            <h1 className="admin-title">Dashboard</h1>
            <p className="admin-subtitle">
              Identify where reps lose control and what to fix first.
            </p>
          </div>
        </div>

          <section className="admin-metric-grid">
            <div className="admin-card admin-metric-card">
              <p className="admin-metric-label">Active users (7d)</p>
              <p className="admin-metric-value">{activeUsers7 || 0}</p>
              <span className="admin-metric-sub">Proxy from call-ended events</span>
            </div>
            <div className="admin-card admin-metric-card">
              <p className="admin-metric-label">Notes captured</p>
              <p className="admin-metric-value">{totalEvents ? `${notesRate}%` : "-"}</p>
              <span className="admin-metric-sub">% of ended calls with notes</span>
            </div>
            <div className="admin-card admin-metric-card">
              <p className="admin-metric-label">Where calls die</p>
              <p className="admin-metric-value">
                {topReasons[0]?.reason || "-"}
              </p>
              <span className="admin-metric-sub">Most common reason</span>
            </div>
            <div className="admin-card admin-metric-card">
              <p className="admin-metric-label">Problem Lab users (30d)</p>
              <p className="admin-metric-value">{problemLabUsers}</p>
              <span className="admin-metric-sub">{problemLabRows} rows created</span>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-head">
              <h2 className="admin-section-title">Failure clusters</h2>
              <p className="admin-section-sub">Signals from the last 30 days.</p>
            </div>
            <div className="admin-split-grid">
              <div className="admin-card">
                <h3 className="admin-card-title">Top failure nodes</h3>
                <div className="admin-pill-stack">
                  {topNodes.map(([node, count]) => (
                    <div key={node} className="admin-pill-row">
                      <span className="admin-pill">{node}</span>
                      <span className="admin-pill-count">{count}</span>
                    </div>
                  ))}
                  {!topNodes.length && (
                    <div className="admin-empty">No node data yet.</div>
                  )}
                </div>
              </div>
              <div className="admin-card">
                <h3 className="admin-card-title">Phase breakdown</h3>
                <div className="admin-bar">
                  <span
                    className="admin-bar-seg phase1"
                    style={{ width: `${phase1Pct}%` }}
                  />
                  <span
                    className="admin-bar-seg phase2"
                    style={{ width: `${phase2Pct}%` }}
                  />
                  <span
                    className="admin-bar-seg phase2-preview"
                    style={{ width: `${phase2PreviewPct}%` }}
                  />
                </div>
                <div className="admin-bar-legend">
                  <span>Phase 1: {phaseCounts.phase1}</span>
                  <span>Phase 2: {phaseCounts.phase2}</span>
                  <span>Preview: {phaseCounts.phase2_preview}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="admin-insight-grid">
            <div className="admin-card">
              <h3 className="admin-card-title">Coaching focus</h3>
              <div className="admin-focus">
                <div>
                  <p className="admin-muted">Top call-ended reasons</p>
                  <div className="admin-list">
                    {topReasons.map((row) => (
                      <div key={row.reason} className="admin-list-row">
                        <span>{row.reason}</span>
                        <span>
                          {row.count} ({row.pct}%)
                        </span>
                      </div>
                    ))}
                    {!topReasons.length && <div className="admin-empty">No data yet.</div>}
                  </div>
                </div>
                <div>
                  <p className="admin-muted">Top failure nodes</p>
                  <div className="admin-list">
                    {topNodes.slice(0, 3).map(([node, count]) => (
                      <div key={node} className="admin-list-row">
                        <span>{node}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                    {!topNodes.length && <div className="admin-empty">No data yet.</div>}
                  </div>
                </div>
                <div>
                  <p className="admin-muted">Phase breakdown</p>
                  <div className="admin-list">
                    <div className="admin-list-row">
                      <span>Phase 1</span>
                      <span>{phaseCounts.phase1}</span>
                    </div>
                    <div className="admin-list-row">
                      <span>Phase 2</span>
                      <span>{phaseCounts.phase2}</span>
                    </div>
                    <div className="admin-list-row">
                      <span>Preview</span>
                      <span>{phaseCounts.phase2_preview}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Notes quality</h3>
              <div className="admin-quality">
                <div className="admin-quality-row">
                  <span>Notes captured</span>
                  <strong>{totalEvents ? `${notesRate}%` : "-"}</strong>
                </div>
                <div className="admin-quality-row">
                  <span>Most common length</span>
                  <strong>{topNoteBucket}</strong>
                </div>
                <div className="admin-quality-grid">
                  {[...noteBuckets.entries()].map(([bucket, count]) => (
                    <div key={bucket} className="admin-quality-card">
                      <span>{bucket}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Problem Lab adoption</h3>
              <div className="admin-quality">
                <div className="admin-quality-row">
                  <span>Users (30d)</span>
                  <strong>{problemLabUsers}</strong>
                </div>
                <div className="admin-quality-row">
                  <span>Rows created</span>
                  <strong>{problemLabRows}</strong>
                </div>
                <div className="admin-list">
                  {topRootCauses.map((row) => (
                    <div key={row.root} className="admin-list-row">
                      <span>{row.root.length > 46 ? `${row.root.slice(0, 46)}...` : row.root}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                  {!topRootCauses.length && (
                    <div className="admin-empty">No root cause data yet.</div>
                  )}
                </div>
              </div>
            </div>

            {feedbackRows && feedbackRows.length ? (
              <div className="admin-card">
                <h3 className="admin-card-title">Hardest part distribution</h3>
                <div className="admin-list">
                  {topFeedback.map(([part, count]) => (
                    <div key={part} className="admin-list-row">
                      <span>{part}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="admin-section" id="users">
            <div className="admin-section-head">
              <div>
                <h2 className="admin-section-title">Users</h2>
                <p className="admin-section-sub">
                  Search by email to see who is stalling and why.
                </p>
              </div>
              <form className="admin-search" action="/admin" method="get">
                <input type="hidden" name="embed" value="1" />
                <input
                  className="admin-input"
                  name="email"
                  placeholder="Search by email"
                  defaultValue={email}
                />
                <button className="admin-button" type="submit">
                  Search
                </button>
              </form>
            </div>

            <div className="admin-user-grid">
              {userCards.map((user) => (
                <div key={user.userId} className="admin-card admin-user-card">
                  <div className="admin-user-head">
                    <div>
                      <p className="admin-user-name">{user.name || "Unknown user"}</p>
                      <p className="admin-user-email">{user.email || "No email"}</p>
                    </div>
                    <Link
                      className="admin-link-btn"
                      href={`/admin/users/${user.userId}?embed=1`}
                    >
                      View
                    </Link>
                  </div>
                  <div className="admin-user-meta">
                    <span>Last seen: {formatShort(user.lastSeen)}</span>
                    <span>Calls ended (30d): {user.count}</span>
                    <span>Top reason: {user.topUserReason}</span>
                    <span>Variety score: {user.varietyScore}</span>
                  </div>
                </div>
              ))}
              {!email && (
                <div className="admin-card admin-empty-card">
                  <p className="admin-empty-title">Search to begin</p>
                  <p className="admin-empty-copy">
                    Enter an email address to surface recent call-ended events.
                  </p>
                </div>
              )}
              {email && !userCards.length && (
                <div className="admin-card admin-empty-card">
                  <p className="admin-empty-title">No results</p>
                  <p className="admin-empty-copy">
                    No call-ended events matched that email in the last 30 days.
                  </p>
                </div>
              )}
            </div>
          </section>
      </main>
    </div>
  );
}
