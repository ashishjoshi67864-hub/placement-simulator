import { useState } from "react";

/* -------------------------------------------------------------
   SKILL TAXONOMY HELPER
   Groups ONLY the candidate's actual extracted skills into
   sensible categories without inventing or hardcoding new skills.
------------------------------------------------------------- */
const TAXONOMY_RULES = [
  {
    category: "Programming Languages",
    test: (s) =>
      /^(javascript|typescript|python|java|c\+\+|c#|c|golang|go|rust|ruby|php|swift|kotlin|html|css|sql|r|scala|dart|bash|shell)$/i.test(
        s.trim()
      ),
  },
  {
    category: "Frameworks & Libraries",
    test: (s) =>
      /(react|vue|angular|node|express|next|django|flask|spring|fastapi|redux|tailwind|bootstrap|jquery|laravel|asp\.net)/i.test(
        s.trim()
      ),
  },
  {
    category: "Databases & Storage",
    test: (s) =>
      /(mongo|postgres|sql|mysql|redis|sqlite|oracle|dynamodb|cassandra|firebase|elasticsearch)/i.test(
        s.trim()
      ),
  },
  {
    category: "Cloud, DevOps & Tools",
    test: (s) =>
      /(git|github|docker|kubernetes|aws|azure|gcp|ci\/cd|linux|jenkins|terraform|postman|nginx|vite|webpack)/i.test(
        s.trim()
      ),
  },
  {
    category: "Core CS & Methodologies",
    test: (s) =>
      /(dsa|data structure|algorithm|oop|system design|rest|graphql|microservice|agile|api|testing)/i.test(
        s.trim()
      ),
  },
];

function groupSkills(skillList) {
  if (!Array.isArray(skillList) || skillList.length === 0) return [];

  const groups = {};
  const uncategorized = [];

  for (const skill of skillList) {
    let matched = false;
    for (const rule of TAXONOMY_RULES) {
      if (rule.test(skill)) {
        if (!groups[rule.category]) groups[rule.category] = [];
        groups[rule.category].push(skill);
        matched = true;
        break;
      }
    }
    if (!matched) {
      uncategorized.push(skill);
    }
  }

  const result = Object.entries(groups).map(([category, items]) => ({
    category,
    skills: items,
  }));

  if (uncategorized.length > 0) {
    result.push({
      category: "Technical & Domain Competencies",
      skills: uncategorized,
    });
  }

  return result;
}

function ResumeAnalysis({ onContinue }) {
  // Lazy initializers prevent setState in effect warnings
  const [analysis] = useState(() => {
    try {
      const saved = sessionStorage.getItem("resumeAnalysis");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [candidate] = useState(() => {
    try {
      const saved = sessionStorage.getItem("candidateProfile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  /* =====================================================
     LOADING STATE
  ===================================================== */
  if (!analysis) {
    return (
      <div className="resume-analysis-page">
        <div className="analysis-container">
          <div className="analysis-loading" role="status">
            <div className="loading-spinner" aria-hidden="true">◌</div>
            <h1>Preparing your analysis...</h1>
            <p>Anvesh is reviewing your resume data.</p>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     SAFE DATA EXTRACTION
  ===================================================== */
  const isDemo = Boolean(analysis.demoMode || analysis.simulationNote);

  const hasAtsScore =
    analysis.atsScore !== null &&
    analysis.atsScore !== undefined &&
    !isNaN(Number(analysis.atsScore));
  const atsScore = hasAtsScore ? Number(analysis.atsScore) : null;

  const hasRoleMatch =
    analysis.roleMatch !== null &&
    analysis.roleMatch !== undefined &&
    !isNaN(Number(analysis.roleMatch));
  const roleMatch = hasRoleMatch ? Number(analysis.roleMatch) : null;

  const projectAnalysis = analysis.projectAnalysis || {};
  const hasProjectScore =
    projectAnalysis.score !== null &&
    projectAnalysis.score !== undefined &&
    !isNaN(Number(projectAnalysis.score));
  const projectScore = hasProjectScore ? Number(projectAnalysis.score) : null;
  const projectSummary =
    projectAnalysis.summary ||
    projectAnalysis.description ||
    "No project analysis available.";

  const rawMatchedSkills = Array.isArray(analysis.matchedSkills) ? analysis.matchedSkills : [];
  const rawMissingSkills = Array.isArray(analysis.missingSkills) ? analysis.missingSkills : [];

  const strengths = Array.isArray(analysis.strengths) ? analysis.strengths : [];
  const areasToImprove = Array.isArray(analysis.areasToImprove) ? analysis.areasToImprove : [];
  const recruiterConcerns = Array.isArray(analysis.recruiterConcerns) ? analysis.recruiterConcerns : [];
  const howToImprove = Array.isArray(analysis.howToImprove) ? analysis.howToImprove : [];

  const decision = analysis.decision || (isDemo ? "Demo (Unscored)" : "Review");
  const summary = analysis.summary || "Your resume has been analyzed by Anvesh.";

  /* Categorized skill groups derived cleanly without unconditional hook violation */
  const categorizedMatched = groupSkills(rawMatchedSkills);
  const categorizedMissing = groupSkills(rawMissingSkills);

  /* =====================================================
     DECISION STYLING
  ===================================================== */
  const getDecisionClass = () => {
    const value = decision.toLowerCase();
    if (isDemo || value.includes("demo") || value.includes("unscored")) {
      return "decision-neutral";
    }
    if (value.includes("shortlist") || value.includes("selected")) {
      return "decision-positive";
    }
    if (value.includes("reject") || value.includes("rejected")) {
      return "decision-negative";
    }
    return "decision-neutral";
  };

  const getScoreLabel = (score) => {
    if (score === null || score === undefined) {
      return "Unscored (Demo)";
    }
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Strong";
    if (score >= 50) return "Average";
    return "Needs Improvement";
  };

  function handleContinue() {
    if (onContinue) {
      onContinue();
      return;
    }
    sessionStorage.setItem("currentStep", "aptitude");
  }

  return (
    <div className="resume-analysis-page">
      <div className="analysis-container">
        {/* HEADER */}
        <header className="analysis-top">
          <p className="tagline">STEP 02 — AI RESUME SCREENING</p>
          <h1>Your resume has been analyzed.</h1>
          <p className="analysis-description">
            {candidate?.name
              ? `${candidate.name}, here is how Anvesh evaluates your profile for the ${candidate.role || "target"} role.`
              : "Here is how Anvesh evaluates your profile for the selected target role."}
          </p>
        </header>

        {/* HONEST DEMO MODE HERO BANNER */}
        {isDemo && (
          <aside className="demo-mode-hero-banner" role="status" aria-label="Demo mode warning">
            <div className="demo-mode-badge-pill">
              <span className="demo-dot" aria-hidden="true">●</span> DEMO MODE ACTIVE
            </div>
            <div className="demo-mode-content">
              <h3>Simulated Demonstration Mode</h3>
              <p>
                {analysis.simulationNote ||
                  "Live AI recruiter evaluation is currently unavailable (Gemini quota exhausted). This is an explicitly labeled demo template. No fake scores, skills, or hiring decisions were invented."}
              </p>
            </div>
          </aside>
        )}

        {/* MAIN SCORE GRID */}
        <section className="score-grid" aria-label="Resume Scoring Overview">
          {/* ATS SCORE */}
          <div className="score-card">
            <div className="score-card-top">
              <span className="score-title">ATS SCORE</span>
              <span className="score-icon" aria-hidden="true">◈</span>
            </div>
            <div className="score-value">
              {atsScore !== null ? atsScore : "—"}
              <span>{atsScore !== null ? "/100" : "(Demo)"}</span>
            </div>
            <div className="score-bar" role="progressbar" aria-valuenow={atsScore ?? 0} aria-valuemin="0" aria-valuemax="100">
              <div
                className="score-bar-fill"
                style={{
                  width: atsScore !== null ? `${Math.min(Math.max(atsScore, 0), 100)}%` : "0%",
                }}
              />
            </div>
            <p className="score-label">{getScoreLabel(atsScore)}</p>
          </div>

          {/* ROLE MATCH */}
          <div className="score-card">
            <div className="score-card-top">
              <span className="score-title">ROLE MATCH</span>
              <span className="score-icon" aria-hidden="true">◎</span>
            </div>
            <div className="score-value">
              {roleMatch !== null ? roleMatch : "—"}
              <span>{roleMatch !== null ? "/100" : "(Demo)"}</span>
            </div>
            <div className="score-bar" role="progressbar" aria-valuenow={roleMatch ?? 0} aria-valuemin="0" aria-valuemax="100">
              <div
                className="score-bar-fill"
                style={{
                  width: roleMatch !== null ? `${Math.min(Math.max(roleMatch, 0), 100)}%` : "0%",
                }}
              />
            </div>
            <p className="score-label">{getScoreLabel(roleMatch)}</p>
          </div>

          {/* SIMULATED DECISION */}
          <div className="score-card decision-card">
            <div className="score-card-top">
              <span className="score-title">SIMULATED DECISION</span>
              <span className="score-icon" aria-hidden="true">✓</span>
            </div>
            <div className={`decision-badge ${getDecisionClass()}`}>
              {decision}
            </div>
            <p className="decision-note">
              {isDemo
                ? "Demo mode: Unscored placeholder. No hiring conclusion invented."
                : "Based on your resume and target role."}
            </p>
          </div>
        </section>

        {/* AI RECRUITER SUMMARY */}
        <section className="analysis-section" aria-labelledby="summary-heading">
          <div className="section-header">
            <span className="section-number">01</span>
            <div>
              <h2 id="summary-heading">AI Recruiter Summary</h2>
              <p>What a simulated recruiter would think after reviewing your resume.</p>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-quote" aria-hidden="true">"</div>
            <p>{summary}</p>
          </div>
        </section>

        {/* REDESIGNED SKILLS SECTION (MATCHED & MISSING) */}
        <section className="analysis-grid skills-analysis-grid" aria-labelledby="skills-heading">
          {/* MATCHED SKILLS */}
          <div className="analysis-section skills-section-box">
            <div className="section-header">
              <span className="section-number">02</span>
              <div>
                <h2 id="skills-heading">Matched Skills</h2>
                <p>Skills aligned with your target role and resume profile.</p>
              </div>
            </div>

            {isDemo && (
              <div className="skills-demo-disclaimer" role="note">
                <span className="disclaimer-badge">DEMO NOTICE</span>
                <span>Skills below are keyword matches extracted from your resume text, not AI-scored proficiency.</span>
              </div>
            )}

            <div className="skills-content-container">
              {rawMatchedSkills.length > 0 ? (
                categorizedMatched.map((group) => (
                  <div key={group.category} className="skill-category-group">
                    <h3 className="skill-category-title">
                      {group.category}
                      <span className="category-count">({group.skills.length})</span>
                    </h3>
                    <div className="skill-chips-row" role="list">
                      {group.skills.map((skill, index) => (
                        <div
                          className="skill-chip skill-match-chip"
                          key={`${group.category}-${skill}-${index}`}
                          role="listitem"
                        >
                          <span className="chip-icon" aria-hidden="true">✓</span>
                          <span className="chip-text">{skill}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-message">No matched skills were identified in the resume text.</p>
              )}
            </div>
          </div>

          {/* MISSING SKILLS */}
          <div className="analysis-section skills-section-box">
            <div className="section-header">
              <span className="section-number">03</span>
              <div>
                <h2>Missing Skills</h2>
                <p>High-value technical competencies that could strengthen your profile.</p>
              </div>
            </div>

            <div className="skills-content-container">
              {rawMissingSkills.length > 0 ? (
                categorizedMissing.map((group) => (
                  <div key={group.category} className="skill-category-group">
                    <h3 className="skill-category-title">
                      {group.category}
                      <span className="category-count">({group.skills.length})</span>
                    </h3>
                    <div className="skill-chips-row" role="list">
                      {group.skills.map((skill, index) => (
                        <div
                          className="skill-chip skill-missing-chip"
                          key={`${group.category}-${skill}-${index}`}
                          role="listitem"
                        >
                          <span className="chip-icon" aria-hidden="true">+</span>
                          <span className="chip-text">{skill}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-skills-notice">
                  <p className="empty-message">
                    {isDemo
                      ? "Skill-gap analysis is paused in Demo Mode. Connect an active Gemini API key to calculate specific role gap recommendations."
                      : "No major skill gaps identified for your target role."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* STRENGTHS */}
        <section className="analysis-section" aria-labelledby="strengths-heading">
          <div className="section-header">
            <span className="section-number">04</span>
            <div>
              <h2 id="strengths-heading">Strengths</h2>
              <p>Key highlights that strengthen your simulated placement candidacy.</p>
            </div>
          </div>
          <div className="insight-list">
            {strengths.length > 0 ? (
              strengths.map((strength, index) => (
                <div className="insight-card" key={index}>
                  <div className="insight-icon" aria-hidden="true">+</div>
                  <p>{strength}</p>
                </div>
              ))
            ) : (
              <p className="empty-message">No strengths listed.</p>
            )}
          </div>
        </section>

        {/* AREAS TO IMPROVE */}
        <section className="analysis-section" aria-labelledby="areas-heading">
          <div className="section-header">
            <span className="section-number">05</span>
            <div>
              <h2 id="areas-heading">Areas to Improve</h2>
              <p>Targeted adjustments that will increase your placement readiness.</p>
            </div>
          </div>
          <div className="insight-list">
            {areasToImprove.length > 0 ? (
              areasToImprove.map((area, index) => (
                <div className="insight-card improvement-card" key={index}>
                  <div className="insight-icon" aria-hidden="true">→</div>
                  <p>{area}</p>
                </div>
              ))
            ) : (
              <p className="empty-message">No major improvement areas identified.</p>
            )}
          </div>
        </section>

        {/* PROJECT ANALYSIS */}
        <section className="analysis-section" aria-labelledby="project-heading">
          <div className="section-header">
            <span className="section-number">06</span>
            <div>
              <h2 id="project-heading">Project Analysis</h2>
              <p>How your technical projects perform from a recruiter's evaluation perspective.</p>
            </div>
          </div>
          <div className="project-analysis-card">
            <div className="project-score">
              <span className="score-number">{projectScore !== null ? projectScore : "—"}</span>
              <span className="score-label">{projectScore !== null ? "/100" : "(Demo)"}</span>
            </div>
            <div className="project-analysis-content">
              <h3>Project Depth & Implementation</h3>
              <p>{projectSummary}</p>
              <div className="project-score-bar" role="progressbar" aria-valuenow={projectScore ?? 0} aria-valuemin="0" aria-valuemax="100">
                <div
                  className="score-bar-fill"
                  style={{
                    width: projectScore !== null ? `${Math.min(Math.max(projectScore, 0), 100)}%` : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* RECRUITER CONCERNS */}
        <section className="analysis-section" aria-labelledby="concerns-heading">
          <div className="section-header">
            <span className="section-number">07</span>
            <div>
              <h2 id="concerns-heading">Recruiter Concerns</h2>
              <p>Signals that could make a technical recruiter or hiring manager hesitate.</p>
            </div>
          </div>
          <div className="concern-list">
            {recruiterConcerns.length > 0 ? (
              recruiterConcerns.map((concern, index) => (
                <div className="concern-card" key={index}>
                  <span className="concern-icon" aria-hidden="true">!</span>
                  <p>{concern}</p>
                </div>
              ))
            ) : (
              <p className="empty-message">No major recruiter concerns identified.</p>
            )}
          </div>
        </section>

        {/* HOW TO IMPROVE */}
        <section className="analysis-section" aria-labelledby="how-heading">
          <div className="section-header">
            <span className="section-number">08</span>
            <div>
              <h2 id="how-heading">How To Improve</h2>
              <p>Actionable roadmap to optimize your profile before actual interviews.</p>
            </div>
          </div>
          <div className="improvement-list">
            {howToImprove.length > 0 ? (
              howToImprove.map((item, index) => (
                <div className="improvement-step" key={index}>
                  <div className="step-number">{String(index + 1).padStart(2, "0")}</div>
                  <p>{item}</p>
                </div>
              ))
            ) : (
              <p className="empty-message">No improvement recommendations available.</p>
            )}
          </div>
        </section>

        {/* CONTINUE FOOTER */}
        <footer className="analysis-footer">
          <div>
            <p className="footer-step">NEXT STAGE</p>
            <h2>Ready for the aptitude round?</h2>
            <p>
              Your resume has passed through simulated screening. Proceed to benchmark your
              quantitative and logical problem-solving abilities.
            </p>
          </div>
          <button
            type="button"
            id="analysis-continue-aptitude-btn"
            className="primary-button"
            onClick={handleContinue}
          >
            Continue to Aptitude →
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ResumeAnalysis;