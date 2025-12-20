"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import "./problem-lab.css";

type Row = {
  id: string;
  symptom: string;
  impact: string | null;
  root_cause: string;
  case_study_company: string | null;
  case_study_challenge: string | null;
  case_study_solution: string | null;
  case_study_result: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const emptyRow = {
  id: "",
  symptom: "",
  impact: "",
  root_cause: "",
  case_study_company: "",
  case_study_challenge: "",
  case_study_solution: "",
  case_study_result: "",
};

export default function ProblemLabClient() {
  const [isEmbed, setIsEmbed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"builder" | "table">("builder");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyRow });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const embed = params.get("embed") === "1";
      setIsEmbed(embed);
      if (embed) {
        document.documentElement.dataset.embed = "1";
      } else {
        delete document.documentElement.dataset.embed;
      }
    } catch (_) {}

    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/clarity", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        const nextRows = data?.rows || [];
        setRows(nextRows);
        if (nextRows.length) {
          setView("table");
          posthog.capture("problem_lab_viewed_table", {
            rowsCount: nextRows.length,
          });
          const lastRoot = nextRows[nextRows.length - 1]?.root_cause;
          if (lastRoot) {
            setForm((prev) => ({ ...prev, root_cause: lastRoot }));
            try { sessionStorage.setItem("problem_lab_root_cause", lastRoot); } catch (_) {}
          }
        }
      } catch (_) {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    try {
      const stored = sessionStorage.getItem("problem_lab_root_cause");
      if (stored) setForm((prev) => ({ ...prev, root_cause: stored }));
    } catch (_) {}
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  const savedCount = rows.length;
  const caseStudyCount = useMemo(() => {
    return rows.filter(
      (row) =>
        !!(row.case_study_company || row.case_study_challenge || row.case_study_solution || row.case_study_result)
    ).length;
  }, [rows]);
  const lastUpdated = useMemo(() => {
    if (!rows.length) return "-";
    const latest = rows
      .map((row) => row.updated_at || row.created_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];
    if (!latest) return "-";
    return new Date(latest).toLocaleDateString();
  }, [rows]);

  const hasCaseStudy = useMemo(() => {
    return (
      !!form.case_study_company?.trim() &&
      (!!form.case_study_challenge?.trim() ||
        !!form.case_study_solution?.trim() ||
        !!form.case_study_result?.trim())
    );
  }, [form]);

  const getRowTimestamp = (row: Row) => row.updated_at || row.created_at || "";
  const getLatestRowId = (list: Row[]) => {
    if (!list.length) return null;
    const latest = list.reduce((acc, row) =>
      getRowTimestamp(row) > getRowTimestamp(acc) ? row : acc
    , list[0]);
    return latest?.id || null;
  };

  const markHighlight = (id: string | null) => {
    if (!id) return;
    setHighlightId(id);
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = setTimeout(() => {
      setHighlightId(null);
    }, 800);
  };

  const onChange = (key: keyof typeof emptyRow, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "root_cause") {
      try { sessionStorage.setItem("problem_lab_root_cause", value); } catch (_) {}
    }
  };

  const resetForm = () => {
    setForm((prev) => ({
      ...emptyRow,
      root_cause: prev.root_cause || "",
    }));
    setEditingId(null);
    setError("");
  };

  const saveRow = async (stayInBuilder: boolean) => {
    if (saving) return;
    setError("");
    if (!form.symptom.trim()) {
      setError("Symptom (problem) is required.");
      return;
    }
    if (!form.root_cause.trim()) {
      setError("Root cause is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editingId || undefined,
        symptom: form.symptom,
        impact: form.impact,
        root_cause: form.root_cause,
        case_study_company: form.case_study_company,
        case_study_challenge: form.case_study_challenge,
        case_study_solution: form.case_study_solution,
        case_study_result: form.case_study_result,
      };
      const res = await fetch("/api/clarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("SAVE_FAILED");
      const refreshed = await fetch("/api/clarity", { cache: "no-store" });
      const data = await refreshed.json();
      const nextRows = data?.rows || [];
      setRows(nextRows);
      const nextHighlight =
        (editingId && nextRows.find((row: Row) => row.id === editingId)?.id) ||
        getLatestRowId(nextRows);
      markHighlight(nextHighlight);
      posthog.capture("problem_lab_row_saved", {
        hasImpact: !!form.impact?.trim(),
        hasCaseStudy,
        symptomLength: form.symptom.trim().length,
      });
      if (stayInBuilder) {
        resetForm();
        setView("builder");
      } else {
        setView("table");
      }
      if (!stayInBuilder && nextRows.length) {
        posthog.capture("problem_lab_viewed_table", {
          rowsCount: nextRows.length,
        });
      }
    } catch (_) {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: Row) => {
    setEditingId(row.id);
    setForm({
      id: row.id,
      symptom: row.symptom || "",
      impact: row.impact || "",
      root_cause: row.root_cause || "",
      case_study_company: row.case_study_company || "",
      case_study_challenge: row.case_study_challenge || "",
      case_study_solution: row.case_study_solution || "",
      case_study_result: row.case_study_result || "",
    });
    setView("builder");
    setError("");
  };

  const deleteRow = async (id: string) => {
    try {
      const res = await fetch(`/api/clarity?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("DELETE_FAILED");
      const nextRows = rows.filter((row) => row.id !== id);
      setRows(nextRows);
      if (highlightId === id) setHighlightId(null);
      posthog.capture("problem_lab_row_deleted");
      if (!nextRows.length) {
        setView("builder");
        resetForm();
      }
    } catch (_) {}
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="problem-lab-content" data-embed={isEmbed ? "1" : undefined}>
        <div className="problem-lab-header-card">
          <div className="problem-lab-header-main">
            <div className="problem-lab-title-row">
              <h1 className="problem-lab-title">Problem Lab</h1>
              <span className="problem-lab-badge">Workspace</span>
            </div>
          </div>
          <div className="problem-lab-header-intro">
            <span className="problem-lab-micro">Built for better calls</span>
            <div className="problem-lab-intro-grid">
              <div className="problem-lab-intro-card">
                <div className="problem-lab-intro-head">
                  <span className="problem-lab-intro-icon" aria-hidden="true">?</span>
                  <span className="problem-lab-intro-label">What this helps you do</span>
                </div>
                <p className="problem-lab-intro-text">
                  Understand the real problems behind your pitch. This helps you
                  see how your solution's core problem actually shows up day-to-day
                  in your prospects' world -- so your conversations sound grounded,
                  not theoretical.
                </p>
              </div>
              <div className="problem-lab-intro-card">
                <div className="problem-lab-intro-head">
                  <span className="problem-lab-intro-icon" aria-hidden="true">i</span>
                  <span className="problem-lab-intro-label">How to use it</span>
                </div>
                <p className="problem-lab-intro-text">
                  Treat this as thinking space, not a test. If you're unsure about
                  any part, that's the point. Use it as a prompt to research, speak
                  to colleagues, and sharpen how well you truly understand your
                  buyers.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="problem-lab-loading">
          <div className="problem-lab-skeleton" />
          <div className="problem-lab-skeleton" />
          <div className="problem-lab-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="problem-lab-content" data-embed={isEmbed ? "1" : undefined}>
      <div className={`problem-lab-header-card ${view === "table" ? "table" : ""}`}>
        <div className="problem-lab-header-main">
          <div className="problem-lab-title-row">
            <h1 className="problem-lab-title">Problem Lab</h1>
            <span className="problem-lab-badge">Workspace</span>
          </div>
          {view === "table" ? (
            <div className="problem-lab-header-chips">
              <span className="problem-lab-chip">Symptoms: {savedCount}</span>
              <span className="problem-lab-chip">Case studies: {caseStudyCount}</span>
              <span className="problem-lab-chip">Last updated: {lastUpdated}</span>
            </div>
          ) : null}
          {view === "table" ? (
            <div className="problem-lab-header-actions">
              <button
                className="problem-lab-button primary"
                onClick={() => {
                  resetForm();
                  setView("builder");
                }}
              >
                Add symptom
              </button>
            </div>
          ) : null}
        </div>
        <div className="problem-lab-header-intro">
          <span className="problem-lab-micro">Built for better calls</span>
          <div className="problem-lab-intro-grid">
            <div className="problem-lab-intro-card">
              <div className="problem-lab-intro-head">
                <span className="problem-lab-intro-icon" aria-hidden="true">?</span>
                <span className="problem-lab-intro-label">What this helps you do</span>
              </div>
              <p className="problem-lab-intro-text">
                Understand the real problems behind your pitch. This helps you
                see how your solution's core problem actually shows up day-to-day
                in your prospects' world -- so your conversations sound grounded,
                not theoretical.
              </p>
            </div>
            <div className="problem-lab-intro-card">
              <div className="problem-lab-intro-head">
                <span className="problem-lab-intro-icon" aria-hidden="true">i</span>
                <span className="problem-lab-intro-label">How to use it</span>
              </div>
              <p className="problem-lab-intro-text">
                Treat this as thinking space, not a test. If you're unsure about
                any part, that's the point. Use it as a prompt to research, speak
                to colleagues, and sharpen how well you truly understand your
                buyers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {view === "builder" ? (
        <div className="problem-lab-builder">
          <div className="problem-lab-left">
              <section className="problem-lab-card">
                <div className="problem-lab-card-head">
                  <h2 className="problem-lab-card-title">Root cause</h2>
                  <span className="problem-lab-note">Saved for this session</span>
                </div>
                <textarea
                  className="problem-lab-textarea"
                  placeholder="What core problem does your product solve?"
                  value={form.root_cause}
                  onChange={(e) => onChange("root_cause", e.target.value)}
                />
              </section>

              <section className="problem-lab-card">
                <div className="problem-lab-card-head">
                  <h2 className="problem-lab-card-title">Symptom row editor</h2>
                  <span className="problem-lab-counter">
                    {savedCount} symptoms saved
                  </span>
                </div>
                <div className="problem-lab-stack">
                  <input
                    className="problem-lab-input"
                    placeholder="Symptom (problem)"
                    value={form.symptom}
                    onChange={(e) => onChange("symptom", e.target.value)}
                  />
                  <textarea
                    className="problem-lab-textarea"
                    placeholder="Impact to the organisation"
                    value={form.impact}
                    onChange={(e) => onChange("impact", e.target.value)}
                  />
                  <div className="problem-lab-row">
                    <input
                      className="problem-lab-input"
                      placeholder="Case study company"
                      value={form.case_study_company}
                      onChange={(e) => onChange("case_study_company", e.target.value)}
                    />
                    <input
                      className="problem-lab-input"
                      placeholder="Result headline"
                      value={form.case_study_result}
                      onChange={(e) => onChange("case_study_result", e.target.value)}
                    />
                  </div>
                  <textarea
                    className="problem-lab-textarea"
                    placeholder="Challenge"
                    value={form.case_study_challenge}
                    onChange={(e) =>
                      onChange("case_study_challenge", e.target.value)
                    }
                  />
                  <textarea
                    className="problem-lab-textarea"
                    placeholder="Solution"
                    value={form.case_study_solution}
                    onChange={(e) => onChange("case_study_solution", e.target.value)}
                  />
                  {error && <div className="problem-lab-note">{error}</div>}
                </div>
                <div className="problem-lab-actions">
                  <div className="problem-lab-note">
                    This saves one symptom row at a time.
                  </div>
                  <div className="problem-lab-actions">
                    <button
                      className="problem-lab-button"
                      onClick={() => saveRow(true)}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Add another symptom"}
                    </button>
                    <button
                      className="problem-lab-button primary"
                      onClick={() => saveRow(false)}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : editingId
                          ? "Save changes"
                          : "Save this symptom"}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <section className="problem-lab-card">
              <div className="problem-lab-card-head">
                <h2 className="problem-lab-card-title">Saved symptoms</h2>
                <span className="problem-lab-counter">{savedCount} saved</span>
              </div>
              <div className="problem-lab-saved-list">
                {rows.map((row) => (
                  <div className="problem-lab-saved-row" key={row.id}>
                    <div>
                      <p className="problem-lab-saved-title">{row.symptom}</p>
                      <p className="problem-lab-saved-meta">
                        {row.impact || "Impact not set"}
                      </p>
                    </div>
                    <div className="problem-lab-saved-actions">
                      <button
                        className="problem-lab-link"
                        onClick={() => startEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        className="problem-lab-link"
                        onClick={() => deleteRow(row.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!rows.length && (
                  <div className="problem-lab-note">No symptoms saved yet.</div>
                )}
              </div>
              {rows.length ? (
                <button
                  className="problem-lab-button problem-lab-saved-button"
                  onClick={() => setView("table")}
                >
                  View full chart
                </button>
              ) : null}
            </section>
          </div>
      ) : (
        <div className="problem-lab-table">
          <div className="problem-lab-actions">
            <div className="problem-lab-note">Problem Lab chart view</div>
          </div>
            {rows.map((row) => {
              const expandedRow = expanded[row.id];
              const hasImpact = !!row.impact?.trim();
              const hasProof = !!(
                row.case_study_company ||
                row.case_study_challenge ||
                row.case_study_solution ||
                row.case_study_result
              );
              return (
                <div
                  className={`problem-lab-rowcard ${expandedRow ? "expanded" : ""} ${
                    highlightId === row.id ? "highlight" : ""
                  }`}
                  key={row.id}
                >
                  <div className="problem-lab-rowtop">
                    <div>
                      <div className="problem-lab-rowlabel">Problem</div>
                      <div className="problem-lab-rowtitle">{row.symptom}</div>
                      <div className="problem-lab-rowchips">
                        {hasImpact ? <span className="problem-lab-chip small">Impact</span> : null}
                        {hasProof ? <span className="problem-lab-chip small">Proof</span> : null}
                        {!hasImpact && !hasProof ? (
                          <span className="problem-lab-chip small">Incomplete</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="problem-lab-rowactions">
                      <button
                        className="problem-lab-icon-btn"
                        onClick={() => startEdit(row)}
                        aria-label="Edit"
                        type="button"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 16.5V20h3.5L19 8.5 15.5 5 4 16.5zM20 7l-3-3 1.5-1.5a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4L20 7z" />
                        </svg>
                      </button>
                      <button
                        className="problem-lab-icon-btn"
                        onClick={() => deleteRow(row.id)}
                        aria-label="Delete"
                        type="button"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z" />
                        </svg>
                      </button>
                      <button
                        className="problem-lab-icon-btn"
                        onClick={() => toggleExpand(row.id)}
                        aria-label={expandedRow ? "Hide proof" : "View proof"}
                        type="button"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 10l5 5 5-5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="problem-lab-rowbody">
                    <div className="problem-lab-field">
                      <div className="problem-lab-field-label">IMPACT TO THE ORG</div>
                      <div className="problem-lab-field-text">
                        {row.impact?.trim() || "Add the consequence this symptom creates internally."}
                      </div>
                    </div>
                    <div className="problem-lab-field">
                      <div className="problem-lab-field-label">ROOT CAUSE YOUR PRODUCT SOLVES</div>
                      <div className="problem-lab-field-text">
                        {row.root_cause?.trim() ||
                          "What deeper problem explains why this symptom exists?"}
                      </div>
                    </div>
                  </div>

                  <div className="problem-lab-proof-preview">
                    <span className="problem-lab-proof-chip">
                      {hasProof
                        ? `Proof: ${row.case_study_company || "Case study"} • ${row.case_study_result || "Result headline"}`
                        : "Proof: Not added yet"}
                    </span>
                    <button
                      className="problem-lab-link problem-lab-proof-toggle"
                      onClick={() => toggleExpand(row.id)}
                      type="button"
                    >
                      {expandedRow ? "Hide proof" : "View proof"}
                    </button>
                  </div>

                  <div className={`problem-lab-proof-card ${expandedRow ? "open" : ""}`}>
                    <div className="problem-lab-proof-grid">
                      <div>
                        <div className="problem-lab-field-label">PROOF (CASE STUDY)</div>
                        <div className="problem-lab-proof-company">
                          {row.case_study_company || "Add a case study to make this believable."}
                        </div>
                      </div>
                      <div>
                        <div className="problem-lab-field-label">CHALLENGE</div>
                        <div className="problem-lab-field-text">
                          {row.case_study_challenge || "Add a case study to make this believable."}
                        </div>
                      </div>
                      <div>
                        <div className="problem-lab-field-label">SOLUTION</div>
                        <div className="problem-lab-field-text">
                          {row.case_study_solution || "Add a case study to make this believable."}
                        </div>
                      </div>
                      <div>
                        <div className="problem-lab-field-label">RESULT</div>
                        <div className="problem-lab-field-text">
                          {row.case_study_result || "Add a case study to make this believable."}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      )}
    </div>
  );
}
