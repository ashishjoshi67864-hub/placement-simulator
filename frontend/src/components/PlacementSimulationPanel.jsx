import { useState } from "react";

/**
 * Helper to read session state safely
 */
function getInitialStageStates() {
  try {
    const profileRaw = sessionStorage.getItem("candidateProfile");
    const resumeRaw = sessionStorage.getItem("resumeAnalysis") || sessionStorage.getItem("resumeText");
    const aptitudeRaw = sessionStorage.getItem("aptitudeResult");
    const projectRaw = sessionStorage.getItem("projectResults");
    const hrRaw = sessionStorage.getItem("hrResult");
    const decisionRaw = sessionStorage.getItem("finalDecision");

    const hasProfile = Boolean(profileRaw);
    const hasResume = Boolean(resumeRaw);
    const hasAptitude = Boolean(aptitudeRaw);
    const hasProject = Boolean(projectRaw);
    const hasHr = Boolean(hrRaw);
    const hasDecision = Boolean(decisionRaw);

    return [
      {
        id: "resume",
        num: "01",
        name: "Resume Screening",
        targetPage: sessionStorage.getItem("resumeAnalysis") ? "analysis" : "resume",
        isCompleted: hasResume,
        isAvailable: hasProfile,
        lockReason: "Candidate Profile is required before Resume Screening. Please complete Candidate Setup first.",
        unlockTarget: "setup",
        unlockLabel: "Go to Candidate Setup",
      },
      {
        id: "aptitude",
        num: "02",
        name: "Aptitude",
        targetPage: "aptitude",
        isCompleted: hasAptitude,
        isAvailable: hasProfile && hasResume,
        lockReason: !hasProfile
          ? "Candidate Setup & Resume Screening are required before taking the Aptitude test."
          : "Resume Screening must be completed before starting the Aptitude assessment.",
        unlockTarget: !hasProfile ? "setup" : "resume",
        unlockLabel: !hasProfile ? "Go to Candidate Setup" : "Go to Resume Screening",
      },
      {
        id: "project",
        num: "03",
        name: "Project Defense",
        targetPage: "project",
        isCompleted: hasProject,
        isAvailable: hasProfile && hasResume && hasAptitude,
        lockReason: "Aptitude test completion is required before unlocking Project Defense.",
        unlockTarget: "aptitude",
        unlockLabel: "Go to Aptitude Round",
      },
      {
        id: "hr",
        num: "04",
        name: "HR Interview",
        targetPage: "hr",
        isCompleted: hasHr,
        isAvailable: hasProfile && hasResume && hasAptitude && hasProject,
        lockReason: "Project Defense must be completed before entering the HR Interview round.",
        unlockTarget: "project",
        unlockLabel: "Go to Project Defense",
      },
      {
        id: "decision",
        num: "05",
        name: "Recruiter Decision",
        targetPage: "decision",
        isCompleted: hasDecision,
        isAvailable: hasProfile && hasResume && hasAptitude && hasProject && hasHr,
        lockReason: "All prior rounds (Resume, Aptitude, Projects, HR) must be completed to generate your final Recruiter Decision.",
        unlockTarget: "hr",
        unlockLabel: "Go to HR Interview",
      },
    ];
  } catch {
    return [];
  }
}

/**
 * PlacementSimulationPanel
 * Interactive 5-stage simulation pipeline panel for ANVESH.
 * Reflects real simulation progression stored in sessionStorage.
 * Prevents skipping prerequisites and explains unlock requirements.
 */
function PlacementSimulationPanel({ onNavigateStage, onStartSetup }) {
  const [stages] = useState(getInitialStageStates);
  const [stageNotice, setStageNotice] = useState(null);

  const [activeStageId, setActiveStageId] = useState(() => {
    const list = getInitialStageStates();
    const firstIncomplete = list.find((s) => !s.isCompleted);
    if (firstIncomplete) return firstIncomplete.id;
    if (list.length > 0) return list[list.length - 1].id;
    return "resume";
  });

  const activeIndex = stages.findIndex((s) => s.id === activeStageId);
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const progressPercent = Math.round(((safeActiveIndex + 1) / (stages.length || 5)) * 100);

  const handleStageClick = (stage) => {
    setActiveStageId(stage.id);

    if (stage.isAvailable) {
      setStageNotice(null);
      if (typeof onNavigateStage === "function") {
        onNavigateStage(stage.targetPage);
      }
    } else {
      // Stage is unavailable — explain clearly why rather than failing silently
      setStageNotice({
        stageName: stage.name,
        reason: stage.lockReason,
        unlockTarget: stage.unlockTarget,
        unlockLabel: stage.unlockLabel,
      });
    }
  };

  const handleUnlockAction = (target) => {
    setStageNotice(null);
    if (target === "setup" && typeof onStartSetup === "function") {
      onStartSetup();
    } else if (typeof onNavigateStage === "function") {
      onNavigateStage(target);
    }
  };

  return (
    <div className="hero-card sim-interactive-panel" aria-label="Placement Simulation Stage Pipeline">
      <div className="card-header">
        <div className="card-header-left">
          <span>PLACEMENT SIMULATION</span>
          <span className="sim-interactive-badge">INTERACTIVE</span>
        </div>
        <div className="card-header-right">
          <span className="status" aria-label="Simulation is Live">
            <span className="live-pulse" aria-hidden="true">●</span> LIVE
          </span>
        </div>
      </div>

      {/* Horizontal Progress Track & Sliding Indicator */}
      <div
        className="pipeline-progress-track"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Simulation pipeline progress"
      >
        <div
          className="pipeline-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="pipeline-sliding-indicator"
          style={{
            transform: `translateX(${safeActiveIndex * 100}%)`,
            width: `${100 / (stages.length || 5)}%`,
          }}
          aria-hidden="true"
        />
      </div>

      {/* Pipeline Stages List */}
      <div className="pipeline" role="list">
        {stages.map((stage) => {
          const isActive = stage.id === activeStageId;
          const isCompleted = stage.isCompleted;
          const isAvailable = stage.isAvailable;

          let stateClass = "locked";
          let stateLabel = "Locked";
          if (isCompleted) {
            stateClass = "completed";
            stateLabel = "Completed";
          } else if (isActive && isAvailable) {
            stateClass = "active in-progress";
            stateLabel = "Active";
          } else if (isAvailable) {
            stateClass = "available";
            stateLabel = "Available";
          }

          return (
            <button
              type="button"
              key={stage.id}
              role="listitem"
              className={`pipeline-item pipeline-interactive-btn ${stateClass} ${isActive ? "is-focused-stage" : ""}`}
              onClick={() => handleStageClick(stage)}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${stage.num} ${stage.name}: ${stateLabel}`}
            >
              <div className="pipeline-item-content">
                <span className="pipeline-num">{stage.num}</span>
                <span className="pipeline-name">{stage.name}</span>
              </div>

              <div className="pipeline-item-status">
                {isCompleted && (
                  <span className="stage-pill pill-completed" title="Round completed">
                    <span aria-hidden="true">✓</span> Done
                  </span>
                )}
                {!isCompleted && isAvailable && (
                  <span className="stage-pill pill-active" title="Ready to enter">
                    <span className="pulse-dot" aria-hidden="true">●</span> Enter
                  </span>
                )}
                {!isAvailable && (
                  <span className="stage-pill pill-locked" title="Complete prerequisites to unlock">
                    <span aria-hidden="true">🔒</span> Locked
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanatory Notice when clicking an unavailable stage */}
      {stageNotice && (
        <div className="sim-panel-notice" role="alert">
          <div className="sim-panel-notice-header">
            <span className="notice-icon" aria-hidden="true">⚠️</span>
            <strong>{stageNotice.stageName} Locked</strong>
          </div>
          <p className="sim-panel-notice-text">{stageNotice.reason}</p>
          <div className="sim-panel-notice-actions">
            <button
              type="button"
              className="notice-action-btn"
              onClick={() => handleUnlockAction(stageNotice.unlockTarget)}
            >
              {stageNotice.unlockLabel} →
            </button>
            <button
              type="button"
              className="notice-dismiss-btn"
              onClick={() => setStageNotice(null)}
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlacementSimulationPanel;
