import { useState, useEffect } from "react";

/* ============================================================
   CONSTANTS
============================================================ */

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/decision/final`;

/* ============================================================
   HELPERS
============================================================ */

function safeJSON(key, fallback = {}) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null") || fallback; }
  catch { return fallback; }
}

function scoreColor(n) {
  if (n >= 75) return "#a855f7";
  if (n >= 55) return "#f59e0b";
  return "#ef4444";
}

function decisionColor(d) {
  return d === "SHORTLISTED" ? "#22c55e" : "#ef4444";
}

/* ============================================================
   SCORE BAR
============================================================ */

function ScoreBar({ label, value, note }) {
  const pct = Math.min(Math.max(Number(value) || 0, 0), 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(pct) }}>
          {pct}<span style={{ fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>/100</span>
          {note && <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>— {note}</span>}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${scoreColor(pct)}, #c084fc)`,
          borderRadius: 999,
          transition: "width 1.2s ease",
        }} />
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function FinalDecision({ onRetry }) {

  /* ── read all session data ── */
  const candidateProfile = safeJSON("candidateProfile");
  const resumeAnalysis   = safeJSON("resumeAnalysis");
  const aptitudeResult   = safeJSON("aptitudeResult");
  const projectResults   = safeJSON("projectResults");
  const hrResult         = safeJSON("hrResult");
  const resumeText       = sessionStorage.getItem("resumeText") || "";

  /* ── detect which stages were actually completed ── */
  const completed = {
    resume:  Boolean(resumeAnalysis?.atsScore  || resumeAnalysis?.decision),
    aptitude: Boolean(aptitudeResult?.score    !== undefined || aptitudeResult?.percentage !== undefined),
    project: Boolean(projectResults?.score     !== undefined),
    hr:      Boolean(hrResult?.overallScore    !== undefined),
  };
  const missingStages = Object.entries({
    "Resume Analysis": !completed.resume,
    "Aptitude":        !completed.aptitude,
    "Project Defense": !completed.project,
    "HR Interview":    !completed.hr,
  }).filter(([, missing]) => missing).map(([name]) => name);

  /* ── state ── */
  const [phase, setPhase]     = useState("loading"); // loading | result | error
  const [result, setResult]   = useState(null);
  const [errMsg, setErrMsg]   = useState("");

  /* ── on mount: use cached result OR call API ── */
  useEffect(() => {
    const cached = safeJSON("finalDecision", null);
    if (cached && cached.decision) {
      setResult(cached);
      setPhase("result");
    } else {
      callAPI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callAPI() {
    setPhase("loading");
    setErrMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateProfile,
          resumeAnalysis,
          aptitudeResult,
          projectResults,
          hrResult,
          resumeText,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      sessionStorage.setItem("finalDecision", JSON.stringify(data));
      setResult(data);
      setPhase("result");
    } catch (err) {
      console.error("Final decision API error:", err);
      setErrMsg("Couldn't generate the recruiter decision. Please check your backend connection.");
      setPhase("error");
    }
  }

  function handleRetry() {
    sessionStorage.removeItem("finalDecision");
    callAPI();
  }

  function handleRestartSimulation() {
    // Clear all simulation data and go back to Candidate Setup
    [
      "candidateProfile", "resumeText", "resumeAnalysis",
      "aptitudeResult", "projectResults", "hrResult", "finalDecision",
    ].forEach(k => sessionStorage.removeItem(k));
    if (typeof onRetry === "function") {
      onRetry();
    }
  }

  /* ============================================================
     LOADING
  ============================================================ */

  if (phase === "loading") {
    return (
      <div className="fd-page">
        <div className="fd-center">
          <div className="fd-spinner" />
          <p className="fd-loading-text">Analyzing your complete simulation…</p>
          <p className="fd-loading-sub">The AI recruiter is reviewing your performance across all stages.</p>
        </div>
        <FDStyles />
      </div>
    );
  }

  /* ============================================================
     ERROR
  ============================================================ */

  if (phase === "error") {
    return (
      <div className="fd-page">
        <div className="fd-center">
          <p style={{ fontSize: 32 }}>⚠️</p>
          <p className="fd-loading-text" style={{ color: "#f87171" }}>{errMsg}</p>
          <button type="button" className="fd-primary-btn" style={{ marginTop: 20 }} onClick={handleRetry}>
            Retry
          </button>
        </div>
        <FDStyles />
      </div>
    );
  }

  /* ============================================================
     RESULT
  ============================================================ */

  const {
    decision          = "NOT SHORTLISTED",
    overallScore      = 0,
    placementReadiness: _placementReadiness = 0,
    recruiterSummary  = "",
    strengths         = [],
    gaps              = [],
    recommendations   = [],
    roundBreakdown    = [],
    simulationNote    = "",
    demoMode          = false,
  } = result || {};

  const isShortlisted = decision === "SHORTLISTED";

  return (
    <div className="fd-page">
      <div className="fd-container">

        {/* ── Step label ── */}
        <p className="fd-step-label">STEP 08 — FINAL RECRUITER DECISION</p>
        <h1 className="fd-title">Your placement simulation is complete.</h1>
        <p className="fd-subtitle">
          Based on your performance across all simulation stages,<br />
          here is the AI recruiter's simulated decision.
        </p>

        {/* ── Missing stages notice ── */}
        {missingStages.length > 0 && (
          <div className="fd-notice">
            ⚠️ Some simulation stages have not been completed yet:&nbsp;
            <strong>{missingStages.join(", ")}</strong>.
            The decision below is based on available data only.
          </div>
        )}

        {/* ── Demo mode notice ── */}
        {demoMode && simulationNote && (
          <div className="fd-notice fd-notice--demo">
            🎭 {simulationNote}
          </div>
        )}

        {/* ── DECISION CARD ── */}
        <div className={`fd-decision-card ${isShortlisted ? "fd-decision-card--yes" : "fd-decision-card--no"}`}>
          <p className="fd-decision-label">SIMULATED RECRUITER DECISION</p>
          <h2 className="fd-decision-verdict" style={{ color: decisionColor(decision) }}>
            {decision}
          </h2>
          <p className="fd-decision-sub">
            {isShortlisted
              ? "Simulation indicates strong placement readiness."
              : "Your current simulation shows areas that need improvement."}
          </p>
        </div>

        {/* ── OVERALL SCORE ── */}
        <div className="fd-card fd-score-wrap">
          <p className="fd-section-label">OVERALL PLACEMENT READINESS</p>
          <div className="fd-big-score" style={{ color: scoreColor(overallScore) }}>
            {overallScore}<span className="fd-big-score-denom">/100</span>
          </div>
          <div className="fd-score-bar-track">
            <div
              className="fd-score-bar-fill"
              style={{ width: `${overallScore}%`, background: `linear-gradient(90deg, ${scoreColor(overallScore)}, #c084fc)` }}
            />
          </div>
          <p className="fd-score-verdict">
            {overallScore >= 75 ? "Excellent — Ready for placement rounds 🌟"
              : overallScore >= 60 ? "Good — Keep polishing before the real interview 👍"
              : "Needs improvement — Focus on weak areas before applying 💪"}
          </p>
        </div>

        {/* ── RECRUITER ASSESSMENT ── */}
        {recruiterSummary && (
          <div className="fd-card">
            <p className="fd-section-label">RECRUITER ASSESSMENT</p>
            <p className="fd-summary-text">{recruiterSummary}</p>
          </div>
        )}

        {/* ── ROUND BREAKDOWN ── */}
        {roundBreakdown.length > 0 && (
          <div className="fd-card">
            <p className="fd-section-label">ROUND BREAKDOWN</p>
            {roundBreakdown.map((r, i) => (
              <ScoreBar key={i} label={r.stage} value={r.score} note={r.interpretation} />
            ))}
          </div>
        )}

        {/* ── STRENGTHS + GAPS ── */}
        <div className="fd-two-col">

          {strengths.length > 0 && (
            <div className="fd-card fd-card--green">
              <p className="fd-section-label">YOUR STRENGTHS</p>
              <ul className="fd-list">
                {strengths.map((s, i) => (
                  <li key={i}>
                    <span className="fd-list-icon fd-list-icon--green">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gaps.length > 0 && (
            <div className="fd-card fd-card--red">
              <p className="fd-section-label">AREAS HOLDING YOU BACK</p>
              <ul className="fd-list">
                {gaps.map((g, i) => (
                  <li key={i}>
                    <span className="fd-list-icon fd-list-icon--red">•</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* ── RECOMMENDATIONS ── */}
        {recommendations.length > 0 && (
          <div className="fd-card">
            <p className="fd-section-label">YOUR NEXT MOVE</p>
            <ol className="fd-rec-list">
              {recommendations.map((r, i) => (
                <li key={i}>
                  <span className="fd-rec-num">{String(i + 1).padStart(2, "0")}</span>
                  {r}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── RESTART ── */}
        <div className="fd-restart-wrap">
          <button
            type="button"
            className="fd-restart-btn"
            onClick={handleRestartSimulation}
          >
            ↺ Retry Simulation →
          </button>
          <p className="fd-restart-note">
            This will clear your simulation data and take you back to Candidate Setup.
          </p>
        </div>

        {/* Bottom padding for nav bar */}
        <div style={{ height: 100 }} />

      </div>
      <FDStyles />
    </div>
  );
}

/* ============================================================
   STYLES  (scoped via class prefix fd-)
============================================================ */

function FDStyles() {
  return (
    <style>{`
      .fd-page {
        min-height: 100vh;
        background: #0a0a0f;
        color: #fff;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        padding: 0 16px;
      }
      .fd-container {
        max-width: 780px;
        margin: 0 auto;
        padding: 48px 0 0;
      }

      /* Loading / center */
      .fd-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 80vh;
        text-align: center;
        gap: 16px;
      }
      .fd-loading-text {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        margin: 0;
      }
      .fd-loading-sub {
        font-size: 14px;
        color: rgba(255,255,255,0.45);
        margin: 0;
      }
      .fd-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid rgba(168,85,247,0.25);
        border-top-color: #a855f7;
        border-radius: 50%;
        animation: fd-spin 0.9s linear infinite;
      }
      @keyframes fd-spin { to { transform: rotate(360deg); } }

      /* Header */
      .fd-step-label {
        font-size: 11px;
        letter-spacing: 3px;
        color: #a855f7;
        text-transform: uppercase;
        margin: 0 0 12px;
        text-align: center;
      }
      .fd-title {
        font-size: clamp(24px, 4vw, 38px);
        font-weight: 800;
        text-align: center;
        margin: 0 0 10px;
        background: linear-gradient(135deg, #fff 0%, #a855f7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .fd-subtitle {
        text-align: center;
        color: rgba(255,255,255,0.45);
        font-size: 14px;
        line-height: 1.6;
        margin: 0 0 28px;
      }

      /* Notices */
      .fd-notice {
        background: rgba(245,158,11,0.08);
        border: 1px solid rgba(245,158,11,0.25);
        border-radius: 12px;
        padding: 12px 18px;
        font-size: 13px;
        color: rgba(245,158,11,0.9);
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .fd-notice--demo {
        background: rgba(168,85,247,0.06);
        border-color: rgba(168,85,247,0.2);
        color: rgba(168,85,247,0.85);
      }

      /* Decision card */
      .fd-decision-card {
        border-radius: 20px;
        padding: 36px 28px;
        text-align: center;
        margin-bottom: 24px;
        border: 2px solid;
      }
      .fd-decision-card--yes {
        background: rgba(34,197,94,0.06);
        border-color: rgba(34,197,94,0.3);
      }
      .fd-decision-card--no {
        background: rgba(239,68,68,0.06);
        border-color: rgba(239,68,68,0.3);
      }
      .fd-decision-label {
        font-size: 10px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.35);
        margin: 0 0 12px;
      }
      .fd-decision-verdict {
        font-size: clamp(32px, 6vw, 52px);
        font-weight: 900;
        letter-spacing: 2px;
        margin: 0 0 10px;
      }
      .fd-decision-sub {
        color: rgba(255,255,255,0.55);
        font-size: 15px;
        margin: 0;
      }

      /* Cards */
      .fd-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        padding: 24px 24px 20px;
        margin-bottom: 20px;
        backdrop-filter: blur(10px);
      }
      .fd-card--green { border-color: rgba(34,197,94,0.2); }
      .fd-card--red   { border-color: rgba(239,68,68,0.2); }

      .fd-section-label {
        font-size: 10px;
        letter-spacing: 2.5px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.35);
        margin: 0 0 16px;
      }

      /* Score wrap */
      .fd-score-wrap { text-align: center; }
      .fd-big-score {
        font-size: 72px;
        font-weight: 900;
        line-height: 1;
        margin-bottom: 12px;
      }
      .fd-big-score-denom {
        font-size: 28px;
        font-weight: 400;
        color: rgba(255,255,255,0.3);
      }
      .fd-score-bar-track {
        height: 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        overflow: hidden;
        margin: 0 auto 12px;
        max-width: 320px;
      }
      .fd-score-bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 1.2s ease;
      }
      .fd-score-verdict {
        font-size: 14px;
        color: rgba(255,255,255,0.5);
        margin: 0;
      }

      /* Summary text */
      .fd-summary-text {
        font-size: 15px;
        line-height: 1.7;
        color: rgba(255,255,255,0.75);
        margin: 0;
      }

      /* Two-col */
      .fd-two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
      }
      @media (max-width: 580px) {
        .fd-two-col { grid-template-columns: 1fr; }
      }

      /* Lists */
      .fd-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .fd-list li {
        display: flex;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        font-size: 14px;
        color: rgba(255,255,255,0.75);
        line-height: 1.5;
      }
      .fd-list li:last-child { border-bottom: none; }
      .fd-list-icon { font-weight: 700; flex-shrink: 0; }
      .fd-list-icon--green { color: #22c55e; }
      .fd-list-icon--red   { color: #f87171; }

      /* Recommendations */
      .fd-rec-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .fd-rec-list li {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        font-size: 14px;
        color: rgba(255,255,255,0.75);
        line-height: 1.5;
      }
      .fd-rec-list li:last-child { border-bottom: none; }
      .fd-rec-num {
        font-size: 11px;
        font-weight: 700;
        color: #a855f7;
        background: rgba(168,85,247,0.12);
        border: 1px solid rgba(168,85,247,0.25);
        border-radius: 6px;
        padding: 2px 7px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      /* Restart */
      .fd-restart-wrap {
        text-align: center;
        padding: 32px 0 0;
      }
      .fd-restart-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.7);
        border-radius: 12px;
        padding: 13px 28px;
        font-size: 15px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
      }
      .fd-restart-btn:hover {
        background: rgba(255,255,255,0.1);
        color: #fff;
      }
      .fd-restart-note {
        font-size: 12px;
        color: rgba(255,255,255,0.3);
        margin: 10px 0 0;
      }

      /* Generic primary button (for error state) */
      .fd-primary-btn {
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 13px 28px;
        font-size: 15px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .fd-primary-btn:hover { opacity: 0.88; }
    `}</style>
  );
}
