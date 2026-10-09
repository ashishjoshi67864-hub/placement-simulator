import { useState } from "react";

function CandidateSetup({ onContinue }) {
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem("candidateProfile");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || "",
          college: parsed.college || "",
          branch: parsed.branch || "",
          cgpa: parsed.cgpa !== undefined ? String(parsed.cgpa) : "",
          role: parsed.role || "",
          jobDescription: parsed.jobDescription || parsed.skills || "",
        };
      }
    } catch {
      /* ignore */
    }
    return {
      name: "",
      college: "",
      branch: "",
      cgpa: "",
      role: "",
      jobDescription: "",
    };
  });

  const [validationError, setValidationError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    if (validationError) setValidationError("");

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    // Basic validation for job description
    const jdClean = formData.jobDescription.trim();
    if (jdClean.length < 10) {
      setValidationError(
        "Please provide a slightly more descriptive job description (at least 10 characters) to personalize your simulation."
      );
      return;
    }

    const candidateProfile = {
      name: formData.name.trim(),
      college: formData.college.trim(),
      branch: formData.branch.trim(),
      cgpa: formData.cgpa.trim(),
      role: formData.role.trim(),
      jobDescription: jdClean,
      // Backward-compatible fallback for endpoints referencing candidateProfile.skills
      skills: jdClean,
    };

    // Save candidate profile in simulation state for subsequent stages
    sessionStorage.setItem("candidateProfile", JSON.stringify(candidateProfile));

    console.log("Candidate Profile saved successfully:", candidateProfile);

    if (typeof onContinue === "function") {
      onContinue();
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        <div className="setup-header">
          <p className="tagline">STEP 01 — CANDIDATE PROFILE</p>
          <h1>Tell us about yourself.</h1>
          <p className="setup-description">
            Anvesh uses your academic background, target role, and the job description to personalize
            the recruitment pipeline, aptitude rubrics, and interview questioning.
          </p>
        </div>

        {validationError && (
          <div className="setup-error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="setup-form" noValidate={false}>
          {/* NAME */}
          <div className="form-group">
            <label htmlFor="setup-name">Full Name</label>
            <input
              id="setup-name"
              type="text"
              name="name"
              placeholder="e.g. Alex Sharma"
              value={formData.name}
              onChange={handleChange}
              required
              autoComplete="name"
            />
          </div>

          {/* COLLEGE */}
          <div className="form-group">
            <label htmlFor="setup-college">College / University</label>
            <input
              id="setup-college"
              type="text"
              name="college"
              placeholder="e.g. National Institute of Technology"
              value={formData.college}
              onChange={handleChange}
              required
              autoComplete="organization"
            />
          </div>

          {/* BRANCH + CGPA */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="setup-branch">Branch / Specialization</label>
              <input
                id="setup-branch"
                type="text"
                name="branch"
                placeholder="e.g. Computer Science Engineering"
                value={formData.branch}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="setup-cgpa">CGPA (Out of 10)</label>
              <input
                id="setup-cgpa"
                type="number"
                name="cgpa"
                placeholder="8.5"
                step="0.01"
                min="0"
                max="10"
                value={formData.cgpa}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* TARGET ROLE */}
          <div className="form-group">
            <label htmlFor="setup-role">Target Placement Role</label>
            <select
              id="setup-role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="">Select a target role</option>
              <option value="Software Developer">Software Developer</option>
              <option value="Frontend Developer">Frontend Developer</option>
              <option value="Backend Developer">Backend Developer</option>
              <option value="Full Stack Developer">Full Stack Developer</option>
              <option value="Data Analyst">Data Analyst</option>
            </select>
          </div>

          {/* TARGET JOB DESCRIPTION (MULTILINE TEXTAREA) */}
          <div className="form-group">
            <div className="label-with-hint">
              <label htmlFor="setup-job-description">Target Job Description</label>
              <span className="field-hint">Defines expectations, requirements & skill keywords</span>
            </div>
            <textarea
              id="setup-job-description"
              name="jobDescription"
              rows={5}
              placeholder="e.g., We are seeking a Software Engineer to develop scalable web services, collaborate across cross-functional teams, and write clean, maintainable code. Requirements: Strong fundamentals in React, Node.js, REST APIs, SQL, and Data Structures & Algorithms."
              value={formData.jobDescription}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-submit-row">
            <button
              type="submit"
              className="primary-button setup-submit-btn"
              id="setup-continue-btn"
            >
              Continue to Resume Screening →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CandidateSetup;