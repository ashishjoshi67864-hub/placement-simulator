const test = require("node:test");
const assert = require("node:assert/strict");

const {
    validateResumeContent,
    extractSkillsFromResume,
    getDemoResumeAnalysis,
} = require("./server.js");

const API_BASE = "http://localhost:5000";

const REALISTIC_RESUME = `
Jane Doe
Email: jane.doe@example.com | Phone: +1-555-0199 | Location: San Francisco, CA
LinkedIn: linkedin.com/in/janedoe | GitHub: github.com/janedoe

EDUCATION
Bachelor of Technology in Computer Science and Engineering
National Institute of Technology, CGPA: 8.9 / 10.0 (Graduated 2024)
Relevant Coursework: Data Structures, Algorithms, Database Systems, Web Development, Cloud Computing

TECHNICAL SKILLS
Languages: Python, JavaScript, TypeScript, SQL
Frameworks & Libraries: React, Node.js, Express, Django
Databases & Tools: PostgreSQL, MongoDB, Docker, Git, REST APIs, Linux

PROJECTS
1. Placement Simulator Platform (React, Node.js, PostgreSQL)
   - Architected and deployed an interactive career preparation web application serving over 1,000 active students.
   - Built full-stack REST APIs for student authentication, mock interviews, and automated evaluation metrics.
   - Integrated PostgreSQL database schema with indexing, improving query response time by 35%.

2. Smart Analytics Dashboard (Python, Django, Docker)
   - Developed automated reporting pipeline processing time-series metrics.
   - Implemented automated Docker containerization for seamless deployment.

EXPERIENCE
Software Engineering Intern — TechNova Labs (June 2023 - August 2023)
- Collaborated with engineering team to implement reusable React components.
- Wrote end-to-end integration tests and participated in daily Agile standups.
`;

test("1. Missing resumeText returns HTTP 400 with INVALID_INPUT", async () => {
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: "Full Stack Developer" }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, "INVALID_INPUT");
    assert.match(body.message, /required/i);
    assert.equal(body.analysis, undefined);
});

test("1b. Non-string resumeText (unexpected type) returns HTTP 400", async () => {
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: 12345, targetRole: "Full Stack Developer" }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, "INVALID_INPUT");
});

test("2. Empty text returns HTTP 400 with EMPTY_RESUME_TEXT", async () => {
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: "    \n\t   ", targetRole: "Software Engineer" }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, "EMPTY_RESUME_TEXT");
    assert.equal(body.analysis, undefined);
});

test("3. 'Dummy PDF file' returns HTTP 422 with INSUFFICIENT_RESUME_CONTENT", async () => {
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: "Dummy PDF file", targetRole: "Software Engineer" }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, "INSUFFICIENT_RESUME_CONTENT");
    assert.match(body.message, /insufficient resume content/i);
    // Must NOT return scores or shortlisted decision
    assert.equal(body.analysis, undefined);
    assert.equal(body.atsScore, undefined);
    assert.equal(body.roleMatch, undefined);
});

test("4. Very short extracted PDF text returns HTTP 422", async () => {
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: "John Doe Software Developer with 2 years experience", targetRole: "Software Engineer" }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, "INSUFFICIENT_RESUME_CONTENT");
    assert.equal(body.analysis, undefined);
});

test("4b. Repetitive placeholder text without genuine sections returns HTTP 422", async () => {
    const repeated = "dummy test placeholder sample dummy test placeholder sample ".repeat(10);
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: repeated, targetRole: "Software Engineer" }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, "INSUFFICIENT_RESUME_CONTENT");
});

test("5 & 6. Realistic resume proceeds to analysis and returns honest demo fallback if Gemini quota unavailable", async () => {
    const res = await fetch(`${API_BASE}/api/resume/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            resumeText: REALISTIC_RESUME,
            targetRole: "Full Stack Developer",
        }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.analysis, "Response must include analysis object");

    if (body.demoMode) {
        // Honest demo fallback checks:
        assert.equal(body.analysis.demoMode, true);
        assert.equal(body.analysis.atsScore, null, "Demo ATS score must NOT be hardcoded fake 86");
        assert.equal(body.analysis.roleMatch, null, "Demo Role match score must NOT be hardcoded fake 88");
        assert.equal(body.analysis.decision, "Demo (Unscored)", "Demo decision must NOT be fake Shortlist");

        // Matched skills must only contain skills actually present in the resume
        assert.ok(Array.isArray(body.analysis.matchedSkills));
        assert.ok(body.analysis.matchedSkills.includes("Python"));
        assert.ok(body.analysis.matchedSkills.includes("React"));
        assert.ok(body.analysis.matchedSkills.includes("PostgreSQL"));
        // Make sure it doesn't invent unmentioned skills
        assert.ok(!body.analysis.matchedSkills.includes("Ruby"));
        assert.ok(!body.analysis.matchedSkills.includes("Swift"));

        // Simulation note must be present
        assert.match(body.analysis.simulationNote, /demo mode notice/i);
    } else {
        // Live Gemini response schema verification
        assert.equal(typeof body.analysis.atsScore, "number");
        assert.equal(typeof body.analysis.roleMatch, "number");
        assert.ok(["Shortlist", "Review", "Reject"].includes(body.analysis.decision));
    }
});

test("7. getDemoResumeAnalysis preserves required schema structure", () => {
    const demo = getDemoResumeAnalysis("Frontend Developer", REALISTIC_RESUME);

    assert.equal(demo.demoMode, true);
    assert.equal(demo.atsScore, null);
    assert.equal(demo.roleMatch, null);
    assert.equal(demo.decision, "Demo (Unscored)");
    assert.ok(typeof demo.summary === "string");
    assert.ok(Array.isArray(demo.matchedSkills));
    assert.ok(Array.isArray(demo.missingSkills));
    assert.ok(Array.isArray(demo.strengths));
    assert.ok(Array.isArray(demo.areasToImprove));
    assert.ok(typeof demo.projectAnalysis === "object");
    assert.equal(demo.projectAnalysis.score, null);
    assert.ok(Array.isArray(demo.recruiterConcerns));
    assert.ok(Array.isArray(demo.howToImprove));
    assert.ok(typeof demo.simulationNote === "string");
});

test("8. extractSkillsFromResume only extracts skills present in text", () => {
    const text1 = "Candidate with skills in Python, Docker, and Django. Built apps.";
    const skills1 = extractSkillsFromResume(text1);
    assert.deepEqual(skills1.sort(), ["Django", "Docker", "Python"]);

    const text2 = "No tech skills mentioned at all in this text.";
    const skills2 = extractSkillsFromResume(text2);
    assert.deepEqual(skills2, []);
});

test("9. Downstream /api/decision/final continues working with demo resume analysis", async () => {
    const demoResume = getDemoResumeAnalysis("Software Engineer", REALISTIC_RESUME);

    const res = await fetch(`${API_BASE}/api/decision/final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            candidateProfile: { name: "Jane Doe", role: "Software Engineer", college: "NIT" },
            resumeAnalysis: demoResume,
            aptitudeResult: { score: 8, total: 10, percentage: 80 },
            projectResults: { score: 85 },
            hrResult: { overallScore: 82 },
            resumeText: REALISTIC_RESUME,
        }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.decision, "Decision should be generated");
    assert.ok(data.overallScore !== undefined, "Overall score should be present");
});
