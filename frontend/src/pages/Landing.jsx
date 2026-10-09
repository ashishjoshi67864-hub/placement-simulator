import PlacementSimulationPanel from "../components/PlacementSimulationPanel";

function Landing({ onStartSimulation, onNavigateStage }) {
  function handleScrollToHow(e) {
    if (e) e.preventDefault();
    const target = document.getElementById("how");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  const steps = [
    {
      num: "01",
      title: "Candidate Profile & Job Match",
      desc: "Specify your target role and paste the job description. Anvesh tunes interview rubrics and ATS criteria to your target company profile.",
    },
    {
      num: "02",
      title: "AI Resume Screening",
      desc: "Upload your resume in PDF format. Receive immediate ATS analysis, skill alignment, gaps, and simulated recruiter notes.",
    },
    {
      num: "03",
      title: "Timed Aptitude Round",
      desc: "Face adaptive numerical, logical, and verbal questions with strict live countdown timers modeled after real corporate screening tests.",
    },
    {
      num: "04",
      title: "Technical & Project Defense",
      desc: "Defend your GitHub projects, architecture choices, and tech stack in real-time questioning powered by conversational AI.",
    },
    {
      num: "05",
      title: "HR & Recruiter Decision",
      desc: "Answer behavioral interview prompts and receive a unified score breakdown, placement readiness verdict, and improvement roadmap.",
    },
  ];

  return (
    <>
      <main className="hero">
        <div className="hero-content">
          <p className="tagline">AI-POWERED PLACEMENT SIMULATOR</p>

          <h1>
            Experience the
            <span> placement </span>
            before the placement.
          </h1>

          <p className="description">
            Anvesh puts you through a simulated recruitment process —
            from resume screening to technical interviews and HR —
            then tells you exactly where you stand.
          </p>

          <div className="hero-buttons">
            <button
              type="button"
              id="start-simulation-hero-btn"
              className="primary-button"
              onClick={onStartSimulation}
            >
              Start Your Simulation →
            </button>

            <button
              type="button"
              id="see-how-it-works-btn"
              className="secondary-button"
              onClick={handleScrollToHow}
            >
              See How It Works
            </button>
          </div>
        </div>

        {/* Interactive Placement Simulation Panel */}
        <PlacementSimulationPanel
          onNavigateStage={onNavigateStage}
          onStartSetup={onStartSimulation}
        />
      </main>

      {/* HOW IT WORKS EXPLANATION SECTION */}
      <section id="how" className="how-it-works-section" aria-labelledby="how-heading">
        <div className="how-container">
          <div className="section-header-centered">
            <p className="tagline">HOW IT WORKS</p>
            <h2 id="how-heading">A Realistic 5-Stage Placement Pipeline</h2>
            <p className="section-subtitle">
              Engineered to replicate actual campus and corporate recruitment drives end-to-end.
            </p>
          </div>

          <div className="how-steps-grid">
            {steps.map((step) => (
              <div key={step.num} className="how-step-card">
                <span className="how-step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="how-cta-container">
            <button
              type="button"
              className="primary-button"
              onClick={onStartSimulation}
            >
              Begin Placement Simulation →
            </button>
          </div>
        </div>
      </section>

      {/* ABOUT / FOOTER SECTION */}
      <footer id="about" className="landing-footer" aria-label="About ANVESH">
        <div className="footer-container">
          <div className="footer-brand">
            <span className="logo">ANVESH</span>
            <p>
              AI-driven placement simulation platform. Practice realistic resume screening,
              technical interviews, and recruiter decisions before your campus placement drives.
            </p>
          </div>
          <div className="footer-meta">
            <p>© 2026 ANVESH. All simulation rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Landing;