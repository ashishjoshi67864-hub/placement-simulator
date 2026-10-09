# ANVESH — AI-Powered Placement Simulator

> **Simulate the real placement process before you face it.**
>
> ANVESH puts you through a five-stage recruitment pipeline — resume screening,
> aptitude assessment, technical interview, project defense, and an HR round —
> then delivers an AI-generated recruiter verdict and improvement roadmap.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Quick Start](#quick-start)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Simulation Stages](#simulation-stages)
10. [Demo / Offline Mode](#demo--offline-mode)
11. [Security Notes](#security-notes)
12. [Accessibility](#accessibility)
13. [Running Tests](#running-tests)
14. [Google Services Used](#google-services-used)
15. [Alignment with Hackathon Problem Statement](#alignment-with-hackathon-problem-statement)
16. [Known Limitations](#known-limitations)
17. [License](#license)

---

## Features

| Stage | What the Candidate Experiences |
|-------|-------------------------------|
| **Candidate Setup** | Enter name, branch, CGPA, target role, and paste the target job description |
| **Resume Upload** | Upload a PDF resume; text is extracted server-side |
| **AI Resume Screening** | Gemini evaluates ATS score, role-match, strengths, gaps, and project depth |
| **Timed Aptitude Test** | 10 adaptive questions (Quantitative + Logical Reasoning) with a countdown timer |
| **Technical Interview** | AI-generated role-specific questions; answers evaluated for technical depth |
| **Project Defense** | AI interrogates a real project with architecture and trade-off questions |
| **HR Interview** | 5 behavioral questions; evaluated on STAR structure, relevance, confidence |
| **Final Decision** | Unified AI recruiter verdict: SHORTLISTED / NOT SHORTLISTED + score breakdown |

**Demo / offline mode** — if the Gemini API quota is exceeded, every AI stage falls back to a
transparent, content-aware demo evaluator. No scores are fabricated; null or
explicit demo values are returned instead.

---

## Architecture Overview

```
+--------------------------------------------------+
|             Browser (React 19 + Vite)            |
|                                                  |
|  Landing -> CandidateSetup -> ResumeUpload       |
|    -> ResumeAnalysis -> Aptitude                 |
|    -> TechnicalInterview -> ProjectDefense        |
|    -> HRInterview -> FinalDecision               |
|                                                  |
|  State transport: sessionStorage                 |
|  (candidateProfile, resumeText, resumeAnalysis,  |
|   aptitudeResult, projectResults, hrResult,       |
|   finalDecision)                                 |
+-------------------+------------------------------+
                    | HTTP/JSON (localhost:5000)
+-------------------v------------------------------+
|           Node.js + Express 5 Backend            |
|                                                  |
|  /api/resume/upload   -> pdf-parse (text extract)|
|  /api/resume/analyze  -> Gemini structured output|
|  /api/project/question -> Gemini                 |
|  /api/project/evaluate -> Gemini                 |
|  /api/hr/question      -> Gemini                 |
|  /api/hr/evaluate      -> Gemini / NLP fallback  |
|  /api/decision/final   -> Gemini                 |
|                                                  |
|  Google Gemini SDK (@google/genai)               |
|  Model waterfall: 2.0-flash -> 1.5-flash (auto)  |
+--------------------------------------------------+
```

---

## Technology Stack

### Frontend
| Tool | Purpose |
|------|---------|
| **React 19** | UI component framework |
| **Vite 8** | Build tool and dev server |
| **Vanilla CSS** | Styling (dark glassmorphism theme) |
| **Web Speech API** | Voice input for HR interview (STT) + question read-aloud (TTS) |
| **oxlint** | Fast linting (0 warnings enforced in CI) |

### Backend
| Tool | Purpose |
|------|---------|
| **Node.js** | Runtime |
| **Express 5** | HTTP server |
| **@google/genai** | Gemini AI SDK |
| **multer** | Multipart PDF upload (memory storage, 5 MB cap) |
| **pdf-parse** | Server-side PDF to plain text extraction |
| **dotenv** | Environment variable management |
| **cors** | Restricted origin allowlist |

---

## Project Structure

```
placement-simulator/
+-- backend/
|   +-- server.js                        # All API routes + AI integration
|   +-- test-resume-validation.test.js   # Node built-in test suite
|   +-- .env                             # (not committed) API keys
|   +-- package.json
+-- frontend/
|   +-- src/
|   |   +-- App.jsx                      # Root router + SimulationNavigation
|   |   +-- App.css                      # Global design system tokens
|   |   +-- pages/
|   |   |   +-- Landing.jsx
|   |   |   +-- CandidateSetup.jsx
|   |   |   +-- ResumeUpload.jsx
|   |   |   +-- ResumeAnalysis.jsx
|   |   |   +-- Aptitude.jsx
|   |   |   +-- TechnicalInterview.jsx
|   |   |   +-- ProjectDefense.jsx
|   |   |   +-- HRInterview.jsx
|   |   +-- FinalDecision.jsx
|   |   +-- components/
|   |       +-- PlacementSimulationPanel.jsx   # Landing pipeline widget
|   +-- package.json
+-- README.md
```

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A **Google Gemini API key** (free tier works; demo mode activates on quota exhaustion)

---

## Quick Start

### 1 — Clone and install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2 — Configure environment

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
# ALLOWED_ORIGINS=https://your-production-domain.com   # optional
# GEMINI_MODELS=gemini-2.0-flash,gemini-1.5-flash      # optional override
```

> **Never commit `.env` to version control.** The `.gitignore` excludes it.

### 3 — Run

Open two terminals:

```bash
# Terminal 1 — Backend
cd backend
node server.js

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key |
| `PORT` | No | `5000` | Backend listen port |
| `ALLOWED_ORIGINS` | No | — | Comma-separated extra CORS origins for production |
| `GEMINI_MODELS` | No | `gemini-2.0-flash,...` | Comma-separated model waterfall override |

---

## API Reference

All endpoints return JSON. The `GEMINI_API_KEY` is used server-side only and is never sent to the browser.

### `POST /api/resume/upload`
Upload a PDF resume. Returns extracted plain text.

**Form-data:** `resume` (file, PDF only, max 5 MB)

```json
{
  "message": "Resume uploaded successfully.",
  "resumeText": "..."
}
```

---

### `POST /api/resume/analyze`
AI-evaluate a resume against a target role.

**Request body:**
```json
{ "resumeText": "...", "targetRole": "Frontend Engineer" }
```

**Response (200):**
```json
{
  "analysis": {
    "atsScore": 74,
    "roleMatch": 68,
    "decision": "Shortlist",
    "summary": "...",
    "matchedSkills": ["React", "TypeScript"],
    "missingSkills": ["GraphQL"],
    "strengths": ["..."],
    "areasToImprove": ["..."],
    "projectAnalysis": { "score": 70, "summary": "..." },
    "recruiterConcerns": ["..."],
    "howToImprove": ["..."]
  },
  "demoMode": false,
  "model": "gemini-2.0-flash"
}
```

**Validation error codes** (400 / 422):
- `INVALID_INPUT` — non-string resumeText
- `EMPTY_RESUME_TEXT` — blank text
- `INSUFFICIENT_RESUME_CONTENT` — too short, placeholder, or no recognized sections

---

### `POST /api/project/question`

```json
// Request
{ "project": "A real-time chat app", "targetRole": "Backend Engineer" }

// 200 OK
{ "question": "...", "difficulty": "Medium", "evaluationFocus": ["..."] }
```

---

### `POST /api/project/evaluate`

```json
// Request
{ "question": "...", "answer": "...", "targetRole": "..." }

// 200 OK
{
  "score": 78,
  "technicalDepth": 75,
  "problemSolving": 80,
  "communication": 80,
  "feedback": "...",
  "strengths": ["..."],
  "improvements": ["..."]
}
```

---

### `POST /api/hr/question`

```json
// Request
{
  "resumeText": "...",
  "candidateProfile": { "name": "...", "role": "...", "branch": "...", "college": "..." },
  "questionNumber": 1,
  "previousQuestions": []
}

// 200 OK
{ "question": "...", "focus": ["Communication", "Role Fit"] }
```

---

### `POST /api/hr/evaluate`

```json
// Request
{ "question": "...", "answer": "...", "candidateProfile": {}, "targetRole": "..." }

// 200 OK
{
  "score": 72,
  "communication": 80,
  "relevance": 70,
  "depth": 65,
  "confidence": 75,
  "feedback": "...",
  "strengths": ["..."],
  "improvements": ["..."]
}
```

**Scoring dimensions** (0–100 each, weighted: communication 25%, relevance 30%, depth 25%, confidence 20%):
- **communication** — clarity, sentence structure, vocabulary diversity
- **relevance** — theme signal matching, direct question overlap
- **depth** — action verbs, STAR structure, concrete entities, metrics
- **confidence** — first-person ownership, assertive language, hedge penalty

---

### `POST /api/decision/final`

```json
// Request
{
  "candidateProfile": {},
  "resumeAnalysis": {},
  "aptitudeResult": {},
  "projectResults": {},
  "hrResult": {},
  "resumeText": ""
}

// 200 OK
{
  "decision": "SHORTLISTED",
  "overallScore": 74,
  "recruiterSummary": "...",
  "strengths": ["..."],
  "gaps": ["..."],
  "recommendations": ["..."],
  "roundBreakdown": [
    { "stage": "Resume Screening", "score": 74, "interpretation": "Strong" },
    { "stage": "Aptitude",         "score": 80, "interpretation": "Strong" },
    { "stage": "Project Defense",  "score": 70, "interpretation": "Good" },
    { "stage": "HR Interview",     "score": 72, "interpretation": "Good Communication" }
  ]
}
```

---

## Simulation Stages

```
Landing
  +-- Candidate Setup  (name, role, branch, CGPA, job description)
       +-- Resume Upload  (PDF -> text extraction)
            +-- Resume Analysis  (ATS score, skill gap, recruiter notes)
                 +-- Aptitude  (10 timed MCQs: Quant + Logical Reasoning)
                      +-- Technical Interview  (5 AI questions)
                           +-- Project Defense  (1 deep-dive project Q&A)
                                +-- HR Interview  (5 behavioral questions)
                                     +-- Final Decision  (unified verdict)
```

State between stages is persisted in `sessionStorage`. The floating **SimulationNavigation** bar at the bottom of the screen lets developers and evaluators jump between any stage without re-completing earlier rounds — intended for demo and testing purposes only.

---

## Demo / Offline Mode

When all Gemini models are unavailable:

- **Resume analysis** — returns `null` for all numeric scores with a clear `simulationNote` banner
- **HR evaluation** — switches to the local NLP engine: STAR detection, action-verb matching, gibberish guard, vocabulary check against a curated 500-word English lexicon
- **Final decision** — computes weighted average of whichever stage scores are available
- Every demo response sets `demoMode: true`; the browser shows a visible notice

> **No scores, decisions, or AI feedback are invented or hardcoded for real candidates.**

---

## Security Notes

| Concern | Mitigation |
|---------|-----------|
| API key exposure | `GEMINI_API_KEY` lives only in `backend/.env`; never sent to the browser |
| CORS | Restricted to `localhost:5173` + `ALLOWED_ORIGINS` env var; wildcard `*` is not used |
| Body size | `express.json({ limit: "1mb" })` prevents JSON payload floods |
| File upload | multer: PDF-only MIME check, 5 MB cap, memory storage (no disk writes) |
| Input length | `targetRole` capped at 100 chars before prompt interpolation |
| Error leakage | 500 responses return a generic message only; full error is logged server-side |
| Prompt injection | User inputs are treated as data fields inside structured prompts |

---

## Accessibility

- All interactive elements have semantic `type` attributes and descriptive labels
- Landing page buttons use `:focus-visible` ring styles for keyboard navigation
- Score ring SVGs include adjacent text labels for screen readers
- Section headings follow a logical `h1 -> h2 -> h3` hierarchy
- The simulation navigation bar is fully keyboard-operable
- Voice input (HR stage) degrades gracefully when Web Speech API is unavailable
- Color contrast ratios maintained above 4.5:1 on primary text

---

## Running Tests

```bash
cd backend
npm test
```

The test suite uses the Node.js built-in `--test` runner and covers `validateResumeContent`:

- Empty string, null, undefined inputs
- Placeholder patterns (`lorem ipsum`, `dummy pdf`, etc.)
- Minimum character and word count thresholds
- Unique-word diversity check
- Resume section detection (education, skills, experience, projects, certifications)

---

## Google Services Used

| Service | How It Is Used |
|---------|---------------|
| **Google Gemini API** (`gemini-2.0-flash` primary) | Resume ATS analysis, technical question generation, project defense evaluation, HR question generation, HR answer scoring, final recruiter decision — all via `@google/genai` SDK with structured JSON output |
| **Gemini Structured Output** (`responseSchema` + `Type`) | The resume analysis endpoint enforces a fully typed JSON schema so AI responses are always machine-parseable without post-processing guesswork |
| **Automatic model waterfall** | On quota exhaustion or temporary errors, the backend retries automatically with `gemini-2.0-flash-lite` -> `gemini-1.5-flash` -> `gemini-1.5-flash-8b` before entering demo mode |

---

## Alignment with Hackathon Problem Statement

ANVESH directly addresses the **placement readiness gap** for engineering students:

1. **Problem** — Students enter campus placements without realistic practice; existing mock tools are static and unresponsive to individual candidate profiles.

2. **Solution** — A dynamic, AI-driven end-to-end pipeline that mirrors actual corporate recruitment stages: ATS screening -> aptitude -> technical -> project defense -> HR -> recruiter decision.

3. **AI Differentiation** — Gemini structured output guarantees schema-consistent evaluation data. The offline HR NLP evaluator uses STAR detection, action-verb heuristics, and gibberish guards so quality does not collapse to zero when the API is unavailable.

4. **Actionable Output** — Every stage produces concrete improvement recommendations (skill gaps, STAR structure advice, DSA preparation tips, behavioral answer coaching), not just a raw score.

5. **Honest Simulation** — Demo mode is fully transparent: null scores and explicit notices replace fabricated numbers. Candidates always know whether they received live AI feedback or a baseline demonstration run.

6. **Personalization** — Questions and evaluations are generated per candidate based on their uploaded resume, stated target role, job description, and previously asked questions (de-duplication), making each simulation session unique.

---

## Known Limitations

- The Technical Interview and HR Interview stages generate questions dynamically per session; there is no persistent question bank or session history across browser tabs.
- Aptitude questions are a static embedded bank of 10 items; a larger randomized pool would improve replay value.
- Simulation state clears when the browser tab is closed (sessionStorage scope).
- No server-side rate limiting is implemented; production deployments should add `express-rate-limit`.
- Voice input (STT) requires a Chromium-based browser; Safari and Firefox have limited or no Web Speech API support.

---

## License

Developed for the **ANVESH Hackathon Submission**. All rights reserved.