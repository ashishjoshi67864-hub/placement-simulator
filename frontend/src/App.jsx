import { useState } from "react";
import "./App.css";

import Landing from "./pages/Landing";
import CandidateSetup from "./pages/CandidateSetup";
import ResumeUpload from "./pages/ResumeUpload";
import ResumeAnalysis from "./pages/ResumeAnalysis";
import Aptitude from "./pages/Aptitude";
import TechnicalInterview from "./pages/TechnicalInterview";
import ProjectDefense from "./pages/ProjectDefense";
import HRInterview from "./pages/HRInterview";
import FinalDecision from "./pages/FinalDecision";

/* ============================================================
   STAGE CONFIGURATION  (all 9 stages, in order)
============================================================ */

const stages = [
  { id: "landing", label: "Landing" },
  { id: "setup", label: "Candidate Setup" },
  { id: "resume", label: "Resume Upload" },
  { id: "analysis", label: "Resume Analysis" },
  { id: "aptitude", label: "Aptitude" },
  { id: "technical", label: "Technical Interview" },
  { id: "project", label: "Project Defense" },
  { id: "hr", label: "HR Interview" },
  { id: "decision", label: "Final Decision" },
];

/* ============================================================
   SIMULATION NAVIGATION
   A floating developer / demo nav bar that sits at the
   bottom of the screen on every page. It does NOT replace
   any existing form buttons — it is an overlay layer only.
============================================================ */

function SimulationNavigation({ page, setPage }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentIndex = stages.findIndex((s) => s.id === page);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex < stages.length - 1;

  function prev() {
    if (canPrev) setPage(stages[currentIndex - 1].id);
  }

  function next() {
    if (canNext) setPage(stages[currentIndex + 1].id);
  }

  /* Jump options exclude Landing (index 0) so you can only
     jump to actual simulation stages. */
  const jumpOptions = stages.slice(1);

  return (
    <div className="sim-nav">

      {/* STAGE INDICATOR */}
      <div className="sim-nav-stage">
        <span className="sim-nav-label">STAGE</span>
        <span className="sim-nav-current">
          {stages[currentIndex]?.label || "—"}
        </span>
        <span className="sim-nav-fraction">
          {currentIndex + 1}&nbsp;/&nbsp;{stages.length}
        </span>
      </div>

      {/* CONTROLS */}
      <div className="sim-nav-controls">

        {/* HOME */}
        <button
          type="button"
          className="sim-nav-btn sim-nav-home"
          onClick={() => setPage("landing")}
          title="Return to Landing"
        >
          ⌂ Home
        </button>

        {/* PREVIOUS */}
        <button
          type="button"
          className="sim-nav-btn"
          onClick={prev}
          disabled={!canPrev}
          title="Previous stage"
        >
          ← Prev
        </button>

        {/* JUMP DROPDOWN */}
        <div className="sim-nav-dropdown-wrap">
          <button
            type="button"
            className="sim-nav-btn sim-nav-jump"
            onClick={() => setDropdownOpen((o) => !o)}
            title="Jump to any stage"
          >
            Jump ▾
          </button>

          {dropdownOpen && (
            <div className="sim-nav-dropdown">
              {jumpOptions.map((stage) => (
                <button
                  type="button"
                  key={stage.id}
                  className={`sim-nav-option ${page === stage.id ? "active" : ""
                    }`}
                  onClick={() => {
                    setPage(stage.id);
                    setDropdownOpen(false);
                  }}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* NEXT */}
        <button
          type="button"
          className="sim-nav-btn sim-nav-next"
          onClick={next}
          disabled={!canNext}
          title="Next stage"
        >
          Next →
        </button>

      </div>
    </div>
  );
}

/* ============================================================
   APP
============================================================ */

function App() {
  const [page, setPage] = useState("landing");

  return (
    <div className="app">

      {/* ==========================================
          LANDING
      ========================================== */}

      {page === "landing" && (
        <>
          <nav className="navbar" aria-label="Main Navigation">

            <div className="logo">
              ANVESH
            </div>

            <div className="nav-links">
              <a
                href="#how"
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById("how");
                  if (target) target.scrollIntoView({ behavior: "smooth" });
                }}
              >
                How it works
              </a>
              <a
                href="#about"
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById("about");
                  if (target) target.scrollIntoView({ behavior: "smooth" });
                }}
              >
                About
              </a>
            </div>

            <button
              type="button"
              id="nav-start-simulation-btn"
              className="nav-button"
              onClick={() => setPage("setup")}
            >
              Start Simulation
            </button>

          </nav>

          <Landing
            onStartSimulation={() => setPage("setup")}
            onNavigateStage={(targetStage) => setPage(targetStage)}
          />
        </>
      )}

      {/* ==========================================
          CANDIDATE SETUP
          onContinue → Resume Upload
      ========================================== */}

      {page === "setup" && (
        <CandidateSetup
          onContinue={() => setPage("resume")}
        />
      )}

      {/* ==========================================
          RESUME UPLOAD
          onContinue → Resume Analysis
      ========================================== */}

      {page === "resume" && (
        <ResumeUpload
          onContinue={() => setPage("analysis")}
        />
      )}

      {/* ==========================================
          RESUME ANALYSIS
          onContinue → Aptitude
      ========================================== */}

      {page === "analysis" && (
        <ResumeAnalysis
          onContinue={() => setPage("aptitude")}
        />
      )}

      {/* ==========================================
          APTITUDE
          onContinue → Technical Interview
      ========================================== */}

      {page === "aptitude" && (
        <Aptitude
          onContinue={() => setPage("technical")}
        />
      )}

      {/* ==========================================
          TECHNICAL INTERVIEW
          onContinue → Project Defense
      ========================================== */}

      {page === "technical" && (
        <TechnicalInterview
          onContinue={() => setPage("project")}
        />
      )}

      {/* ==========================================
          PROJECT DEFENSE
          onContinue → HR Interview
      ========================================== */}

      {page === "project" && (
        <ProjectDefense
          onContinue={() => setPage("hr")}
        />
      )}

      {/* ==========================================
          HR INTERVIEW
          onContinue → Final Decision
      ========================================== */}

      {page === "hr" && (
        <HRInterview
          onContinue={() => setPage("decision")}
        />
      )}

      {/* ==========================================
          FINAL RECRUITER DECISION
          onRetry → Candidate Setup (restart)
      ========================================== */}

      {page === "decision" && (

        <FinalDecision
          onRetry={() => setPage("setup")}
        />
      )}

      {/* ==========================================
          GLOBAL SIMULATION NAVIGATION
          Rendered on every page as a demo/dev layer.
          Does NOT interfere with any existing form buttons.
      ========================================== */}

      <SimulationNavigation page={page} setPage={setPage} />

    </div>
  );
}

export default App;