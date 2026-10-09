import { useState } from "react";

function ResumeUpload({ onContinue }) {
  const [resume, setResume] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [candidateProfile] = useState(() => {
    try {
      const saved = sessionStorage.getItem("candidateProfile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  function clearPreviousAnalysisState() {
    sessionStorage.removeItem("resumeAnalysis");
    sessionStorage.removeItem("resumeText");
    sessionStorage.removeItem("analysisModel");
    sessionStorage.removeItem("isDemoMode");
  }

  function handleFileSelected(file) {
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErrorMessage("Please upload a PDF resume (.pdf format only).");
      setResume(null);
      return;
    }

    setResume(file);
    setErrorMessage("");
    clearPreviousAnalysisState();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    handleFileSelected(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelected(file);
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // Reset previous analysis state to prevent stale scores
    clearPreviousAnalysisState();
    setErrorMessage("");

    // CHECK RESUME
    if (!resume) {
      setErrorMessage("Please select or drop your resume before continuing.");
      return;
    }

    if (resume.type !== "application/pdf") {
      setErrorMessage("Please upload a PDF resume (.pdf format only).");
      return;
    }

    // GET CANDIDATE PROFILE
    const savedProfile = sessionStorage.getItem("candidateProfile");
    if (!savedProfile) {
      setErrorMessage(
        "Candidate profile not found. Please return to Candidate Setup and fill it first."
      );
      return;
    }

    const profile = JSON.parse(savedProfile);
    console.log("Candidate profile loaded for screening:", profile);

    // CREATE FORM DATA
    const formData = new FormData();
    formData.append("resume", resume);

    try {
      setUploading(true);

      // STEP 1 — UPLOAD RESUME
      console.log("Uploading resume to backend...");
      const uploadResponse = await fetch("http://localhost:5000/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      console.log("Resume upload response:", uploadData);

      if (!uploadResponse.ok) {
        setErrorMessage(uploadData.message || "Resume upload failed.");
        clearPreviousAnalysisState();
        return;
      }

      // STEP 2 — EXTRACTED TEXT
      const resumeText = uploadData.resumeText;
      if (!resumeText) {
        setErrorMessage("Could not extract readable text from the resume PDF.");
        clearPreviousAnalysisState();
        return;
      }

      // STEP 3 — SEND RESUME TO ANALYSIS
      console.log("Sending resume text to Anvesh AI analysis...");
      const analyzeResponse = await fetch("http://localhost:5000/api/resume/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText,
          targetRole: profile.role || "Software Developer",
        }),
      });

      const analyzeData = await analyzeResponse.json();
      console.log("AI analysis response:", analyzeData);

      if (!analyzeResponse.ok) {
        setErrorMessage(analyzeData.message || "AI resume analysis failed.");
        clearPreviousAnalysisState();
        return;
      }

      // STEP 4 — SAVE RESULTS
      sessionStorage.setItem("resumeAnalysis", JSON.stringify(analyzeData.analysis));
      sessionStorage.setItem("resumeText", resumeText);

      if (analyzeData.demoMode || analyzeData.analysis?.demoMode) {
        sessionStorage.setItem("isDemoMode", "true");
      }

      if (analyzeData.model) {
        sessionStorage.setItem("analysisModel", analyzeData.model);
      }

      // STEP 5 — NAVIGATE TO ANALYSIS
      if (typeof onContinue === "function") {
        onContinue();
      }
    } catch (error) {
      console.error("Resume analysis network error:", error);
      setErrorMessage(
        "Could not connect to the Anvesh backend at http://localhost:5000. Please ensure the server is running."
      );
      clearPreviousAnalysisState();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="resume-page">
      <div className="resume-container">
        {/* HEADER SECTION */}
        <header className="resume-header">
          <p className="tagline">STEP 02 — RESUME SCREENING</p>
          <h1>Let's see what your resume says.</h1>
          <p className="resume-subtitle">
            Upload your resume in PDF format. Anvesh will benchmark it against your target role
            and simulate corporate ATS evaluation.
          </p>
        </header>

        {/* CANDIDATE CONTEXT CARD */}
        {candidateProfile && (
          <aside className="candidate-context-card" aria-label="Selected candidate profile">
            <div className="context-card-main">
              <div className="context-meta-group">
                <span className="context-label">CANDIDATE</span>
                <span className="context-value">{candidateProfile.name || "Candidate"}</span>
              </div>
              <div className="context-meta-group">
                <span className="context-label">TARGET ROLE</span>
                <span className="context-badge">{candidateProfile.role || "Software Developer"}</span>
              </div>
              <div className="context-meta-group">
                <span className="context-label">ACADEMIC BACKGROUND</span>
                <span className="context-value">
                  {candidateProfile.college ? `${candidateProfile.college}` : "Engineering"}
                  {candidateProfile.branch ? ` (${candidateProfile.branch})` : ""}
                </span>
              </div>
            </div>

            {candidateProfile.jobDescription && (
              <div className="context-jd-preview">
                <span className="context-jd-tag">Target Job Description</span>
                <p className="context-jd-text">
                  "{candidateProfile.jobDescription.length > 140
                    ? `${candidateProfile.jobDescription.slice(0, 140)}...`
                    : candidateProfile.jobDescription}"
                </p>
              </div>
            )}
          </aside>
        )}

        {/* UPLOAD FORM */}
        <form onSubmit={handleSubmit} className="resume-form" noValidate>
          {/* VALIDATION NOTICES */}
          {errorMessage && (
            <div className="upload-error-box" role="alert">
              <div className="upload-error-header">
                <span className="upload-error-icon" aria-hidden="true">✕</span>
                <strong>Validation Notice</strong>
              </div>
              <p className="upload-error-text">{errorMessage}</p>
            </div>
          )}

          {/* DROPZONE / FILE SELECTION */}
          <label
            htmlFor="resume-upload-input"
            className={`upload-box ${isDragging ? "is-dragover" : ""} ${resume ? "has-file" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("resume-upload-input")?.click();
              }
            }}
            aria-label={resume ? `Selected file: ${resume.name}` : "Upload resume PDF file"}
          >
            <input
              id="resume-upload-input"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              tabIndex={-1}
            />

            <div className="upload-icon-circle" aria-hidden="true">
              {resume ? "📄" : "↑"}
            </div>

            <div className="upload-box-details">
              <h3>{resume ? resume.name : "Choose or drag & drop your resume"}</h3>
              <p>
                {resume
                  ? `${formatFileSize(resume.size)} • PDF ready for screening`
                  : "PDF format only • Up to 5 MB"}
              </p>
            </div>

            {resume && (
              <span className="upload-file-status-badge">
                ✓ Ready for ATS Screening
              </span>
            )}
          </label>

          {/* ACTION BUTTON */}
          <div className="resume-actions-row">
            <button
              type="submit"
              id="submit-resume-btn"
              className="primary-button resume-continue-btn"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="button-spinner" aria-hidden="true">◌</span>
                  Analyzing with AI Recruiter...
                </>
              ) : (
                "Continue to Analysis →"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResumeUpload;