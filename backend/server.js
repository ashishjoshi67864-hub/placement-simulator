require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 5000;

/* =========================================================
   GEMINI SETUP
========================================================= */

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

/*
  We try models in this order.

  If Gemini quota is exhausted, we automatically
  switch to DEMO MODE so the hackathon flow
  does not stop.
*/

const GEMINI_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
];

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());
app.use(express.json());

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024,
    },

    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed."));
        }
    },
});

/* =========================================================
   BASIC ROUTE
========================================================= */

app.get("/", (req, res) => {
    res.json({
        message: "Anvesh backend is running 🚀",
        status: "online",
    });
});

/* =========================================================
   QUOTA ERROR DETECTOR
========================================================= */

function isQuotaError(error) {
    const message = error?.message || "";

    return (
        error?.status === 429 ||
        message.includes("RESOURCE_EXHAUSTED") ||
        message.includes("Quota exceeded") ||
        message.includes("quota exceeded") ||
        message.includes("quota_exceeded")
    );
}

/* =========================================================
   TEMPORARY ERROR DETECTOR
========================================================= */

function isTemporaryError(error) {
    const message = error?.message || "";

    return (
        error?.status === 503 ||
        message.includes("503") ||
        message.includes("UNAVAILABLE") ||
        message.includes("overloaded")
    );
}

/* =========================================================
   GEMINI AI GENERATOR
========================================================= */

async function generateAI(prompt, responseSchema = null) {

    for (const model of GEMINI_MODELS) {

        try {

            console.log(`\n🤖 Trying Gemini model: ${model}`);

            const config = {
                responseMimeType: "application/json",
            };

            if (responseSchema) {
                config.responseSchema = responseSchema;
            }

            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config,
            });

            console.log(`✅ Gemini response received from ${model}`);

            return {
                success: true,
                data: JSON.parse(response.text),
                model,
                demoMode: false,
            };

        } catch (error) {

            console.log(
                `❌ ${model} failed:`,
                error?.message || error
            );

            /* -----------------------------------------------
               QUOTA EXHAUSTED
            ------------------------------------------------ */

            if (isQuotaError(error)) {

                console.log(
                    `⚠️ Quota exhausted for ${model}.`
                );

                /*
                  Don't keep retrying the same model.
        
                  Move to the next model once.
                */

                continue;
            }

            /* -----------------------------------------------
               TEMPORARY GEMINI ERROR
            ------------------------------------------------ */

            if (isTemporaryError(error)) {

                console.log(
                    `⚠️ Temporary Gemini problem with ${model}.`
                );

                continue;
            }

            /*
              Unknown error.
              Try next model.
            */

            continue;
        }
    }

    /*
      Every model failed.
  
      Instead of breaking the hackathon,
      tell the caller to use Demo Mode.
    */

    return {
        success: false,
        quotaExceeded: true,
        demoMode: true,
    };
}

/* =========================================================
   RESUME UPLOAD + PDF TEXT EXTRACTION
========================================================= */

app.post(
    "/api/resume/upload",
    upload.single("resume"),
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    message: "No resume uploaded.",
                });
            }

            console.log(
                `📄 Resume received: ${req.file.originalname}`
            );

            const parser = new PDFParse({
                data: req.file.buffer,
            });

            const result = await parser.getText();

            await parser.destroy();

            const resumeText = result.text;

            console.log(
                `✅ Resume text extracted: ${resumeText.length} characters`
            );

            return res.json({
                message: "Resume uploaded successfully.",
                resumeText,
            });

        } catch (error) {

            console.error(
                "❌ Resume upload error:",
                error
            );

            return res.status(500).json({
                message: "Failed to process resume.",
                error: error.message,
            });
        }
    }
);

/* =========================================================
   RESUME VALIDATION & SKILL EXTRACTION
========================================================= */

const COMMON_SKILLS = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "C", "Go", "Golang", "Rust",
    "Ruby", "PHP", "Swift", "Kotlin", "Dart", "R", "Scala", "HTML", "CSS", "Sass",
    "React", "React Native", "Next.js", "Vue", "Vue.js", "Angular", "Svelte",
    "Node.js", "Express", "Express.js", "NestJS", "Django", "Flask", "FastAPI",
    "Spring", "Spring Boot", "ASP.NET", ".NET", "Rails",
    "SQL", "MySQL", "PostgreSQL", "Postgres", "MongoDB", "Redis", "SQLite", "Oracle",
    "Cassandra", "DynamoDB", "Firebase", "Supabase",
    "Git", "GitHub", "GitLab", "Docker", "Kubernetes", "AWS", "Amazon Web Services",
    "Azure", "GCP", "Google Cloud", "CI/CD", "Linux", "Unix", "Bash", "Shell",
    "REST", "REST APIs", "GraphQL", "gRPC", "Microservices", "Kafka", "RabbitMQ",
    "DSA", "Data Structures", "Algorithms", "System Design", "OOP",
    "Machine Learning", "Deep Learning", "NLP", "TensorFlow", "PyTorch",
    "Scikit-Learn", "Pandas", "NumPy", "Tailwind", "Tailwind CSS", "Bootstrap",
    "Jest", "Mocha", "Cypress", "Selenium", "Postman", "Agile", "Scrum",
];

function extractSkillsFromResume(text) {
    if (!text || typeof text !== "string") return [];
    const matched = [];
    const lowerText = text.toLowerCase();
    for (const skill of COMMON_SKILLS) {
        const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, "i");
        if (regex.test(text)) {
            if (skill === "Java" && lowerText.includes("javascript") && !/(^|[^a-zA-Z0-9_])java([^a-zA-Z0-9_]|$)/i.test(text.replace(/javascript/gi, ""))) {
                continue;
            }
            if (skill === "C" && !/(^|[^a-zA-Z0-9_+#])c([^a-zA-Z0-9_+#]|$)/i.test(text)) {
                continue;
            }
            if (skill === "R" && !/(^|[^a-zA-Z0-9_+#])r([^a-zA-Z0-9_+#]|$)/i.test(text)) {
                continue;
            }
            matched.push(skill);
        }
    }
    return matched.slice(0, 10);
}

function validateResumeContent(resumeText) {
    if (resumeText === undefined || resumeText === null || typeof resumeText !== "string") {
        return {
            isValid: false,
            status: 400,
            code: "INVALID_INPUT",
            message: "Resume text is required and must be a valid string.",
        };
    }

    const trimmed = resumeText.trim();
    if (trimmed.length === 0) {
        return {
            isValid: false,
            status: 400,
            code: "EMPTY_RESUME_TEXT",
            message: "Resume text cannot be empty.",
        };
    }

    const normalized = trimmed.replace(/\s+/g, " ");

    const placeholderPatterns = [
        /^dummy(\s+pdf)?(\s+file)?$/i,
        /^test(\s+file|\s+resume|\s+pdf)?$/i,
        /^sample(\s+resume|\s+file|\s+pdf)?$/i,
        /^lorem\s+ipsum/i,
        /^asdf+$/i,
        /^placeholder(\s+resume|\s+text)?$/i,
    ];

    if (placeholderPatterns.some((pattern) => pattern.test(normalized))) {
        return {
            isValid: false,
            status: 422,
            code: "INSUFFICIENT_RESUME_CONTENT",
            message: "Insufficient resume content. Please upload a complete resume containing meaningful education, skills, or project experience.",
        };
    }

    const words = normalized.split(/\s+/).filter(Boolean);

    // Minimum character and word count check
    if (normalized.length < 150 || words.length < 30) {
        return {
            isValid: false,
            status: 422,
            code: "INSUFFICIENT_RESUME_CONTENT",
            message: "Insufficient resume content. Please upload a complete resume containing meaningful education, skills, or project experience.",
        };
    }

    // Guard against repetitive placeholder text
    const placeholderWordSet = new Set(["dummy", "test", "sample", "placeholder", "lorem", "ipsum", "asdf", "file", "pdf"]);
    const substantiveWords = words.filter((w) => !placeholderWordSet.has(w.toLowerCase().replace(/[^a-z]/g, "")));
    if (substantiveWords.length < 25) {
        return {
            isValid: false,
            status: 422,
            code: "INSUFFICIENT_RESUME_CONTENT",
            message: "Insufficient resume content. Please upload a complete resume containing meaningful education, skills, or project experience.",
        };
    }

    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    if (uniqueWords.size < 20) {
        return {
            isValid: false,
            status: 422,
            code: "INSUFFICIENT_RESUME_CONTENT",
            message: "Insufficient resume content. Please upload a complete resume containing meaningful education, skills, or project experience.",
        };
    }

    // Require indicators from at least two standard resume sections
    const resumeSectionPatterns = [
        /\b(education|academic|degree|bachelor|master|b\.?tech|m\.?tech|b\.?e\.?|b\.?s\.?|m\.?s\.?|university|college|school|cgpa|gpa)\b/i,
        /\b(experience|intern|internship|employment|work history|career|freelance|developer|engineer|analyst)\b/i,
        /\b(project|projects|hackathon|portfolio|capstone|application|built|developed|implemented)\b/i,
        /\b(skills?|technologies|tech stack|proficiencies|tools|languages|frameworks|database|libraries)\b/i,
        /\b(certifications?|certificates?|achievements?|awards?|publications?|extracurricular|activities)\b/i,
    ];

    const matchedSections = resumeSectionPatterns.filter((pattern) => pattern.test(normalized)).length;
    if (matchedSections < 2) {
        return {
            isValid: false,
            status: 422,
            code: "INSUFFICIENT_RESUME_CONTENT",
            message: "Insufficient resume content. Please upload a complete resume containing meaningful education, skills, or project experience.",
        };
    }

    return {
        isValid: true,
        normalizedText: normalized,
    };
}

/* =========================================================
   DEMO RESUME ANALYSIS (HONEST FALLBACK)
========================================================= */

function getDemoResumeAnalysis(targetRole, resumeText = "") {
    const matchedSkills = extractSkillsFromResume(resumeText);

    return {
        demoMode: true,
        atsScore: null,
        roleMatch: null,
        decision: "Demo (Unscored)",
        summary:
            `[DEMO MODE] Live AI evaluation is currently unavailable because the Gemini API quota is exhausted. This is an unscored demonstration placeholder for the ${targetRole} role. Your resume text was validated, but no personalized AI scoring or hiring decisions were generated.`,
        matchedSkills,
        missingSkills: [],
        strengths: [
            "Resume passed structural content validation (sufficient length, recognized sections)",
            "Demo Mode: Live AI evaluation was unavailable — candidate strengths were not scored",
        ],
        areasToImprove: [
            "Connect an active Gemini API key to receive AI-driven candidate feedback",
            `Review key technical competencies expected for a ${targetRole} role`,
        ],
        projectAnalysis: {
            score: null,
            summary:
                "Demo Mode: Live AI evaluation was unavailable. Project complexity was not scored.",
        },
        recruiterConcerns: [
            "Live AI recruiter evaluation was unavailable. Individual accomplishments were not reviewed.",
        ],
        howToImprove: [
            "Provide an active Gemini API key to receive personalized AI recruiter recommendations.",
            `Quantify technical project outcomes relevant to ${targetRole}.`,
        ],
        simulationNote:
            "DEMO MODE NOTICE: Live Gemini AI analysis is currently unavailable. No personalized scores, skills, or hiring decisions were invented for this candidate. You may continue to the next stages of the simulation with baseline demo values.",
    };
}

/* =========================================================
   RESUME ANALYSIS
========================================================= */

app.post(
    "/api/resume/analyze",
    async (req, res) => {

        try {

            const {
                resumeText,
                targetRole,
            } = req.body || {};

            const validation = validateResumeContent(resumeText);
            if (!validation.isValid) {
                console.log(
                    `❌ Resume validation rejected: [${validation.code}] ${validation.message}`
                );
                return res.status(validation.status).json({
                    code: validation.code,
                    message: validation.message,
                });
            }

            const normalizedText = validation.normalizedText;
            const role = typeof targetRole === "string" && targetRole.trim()
                ? targetRole.trim()
                : "Software Engineer";

            console.log(
                `🧠 Starting AI resume analysis for: ${role}`
            );

            /* -----------------------------------------------
               STRUCTURED OUTPUT SCHEMA
            ------------------------------------------------ */

            const responseSchema = {

                type: Type.OBJECT,

                properties: {

                    atsScore: {
                        type: Type.NUMBER,
                    },

                    roleMatch: {
                        type: Type.NUMBER,
                    },

                    decision: {
                        type: Type.STRING,
                    },

                    summary: {
                        type: Type.STRING,
                    },

                    matchedSkills: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                    },

                    missingSkills: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                    },

                    strengths: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                    },

                    areasToImprove: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                    },

                    projectAnalysis: {
                        type: Type.OBJECT,

                        properties: {

                            score: {
                                type: Type.NUMBER,
                            },

                            summary: {
                                type: Type.STRING,
                            },

                        },

                        required: [
                            "score",
                            "summary",
                        ],
                    },

                    recruiterConcerns: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                    },

                    howToImprove: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                        },
                    },

                },

                required: [
                    "atsScore",
                    "roleMatch",
                    "decision",
                    "summary",
                    "matchedSkills",
                    "missingSkills",
                    "strengths",
                    "areasToImprove",
                    "projectAnalysis",
                    "recruiterConcerns",
                    "howToImprove",
                ],
            };

            /* -----------------------------------------------
               PROMPT
            ------------------------------------------------ */

            const prompt = `

You are an AI recruiter inside a placement simulation platform
called ANVESH.

Your job is to simulate how a recruiter/ATS system would evaluate
a student's resume for a target role.

IMPORTANT:
This is a SIMULATION.
Do not claim that this is a real hiring decision.

Target Role:
${role}

Resume:
${normalizedText}

Analyze the resume carefully.

Return:

1. ATS score from 0 to 100
2. Role match score from 0 to 100
3. Simulated decision:
   - Shortlist
   - Review
   - Reject

4. Recruiter summary
5. Matched skills
6. Missing skills
7. Strengths
8. Areas to improve
9. Project analysis
10. Recruiter concerns
11. Personalized improvement suggestions

Be realistic and concise.

`;

            /* -----------------------------------------------
               CALL GEMINI
            ------------------------------------------------ */

            const result = await generateAI(
                prompt,
                responseSchema
            );

            /* -----------------------------------------------
               GEMINI FAILED → DEMO MODE
            ------------------------------------------------ */

            if (!result.success) {

                console.log(
                    "\n⚠️ Gemini unavailable."
                );

                console.log(
                    "🎭 Switching Anvesh to DEMO AI mode."
                );

                const demoAnalysis =
                    getDemoResumeAnalysis(role, normalizedText);

                return res.json({

                    analysis: demoAnalysis,

                    demoMode: true,

                    message:
                        "Gemini quota exhausted. Anvesh is running in Demo AI mode with an unscored simulation template.",

                });
            }

            /* -----------------------------------------------
               REAL AI RESULT
            ------------------------------------------------ */

            console.log(
                `\n✅ Resume analysis completed using ${result.model}`
            );

            return res.json({

                analysis: result.data,

                demoMode: false,

                model: result.model,

            });

        } catch (error) {

            console.error(
                "\n❌ AI resume analysis error:",
                error
            );

            return res.status(500).json({

                message:
                    "Resume analysis failed.",

                error:
                    error.message,

            });
        }
    }
);

/* =========================================================
   DEMO PROJECT QUESTION
========================================================= */

function getDemoProjectQuestion() {

    return {

        question:
            "Explain the most challenging technical problem you solved in one of your projects and how you solved it.",

        difficulty:
            "Medium",

        evaluationFocus: [
            "Problem solving",
            "Technical depth",
            "Decision making",
            "Communication",
        ],

    };
}

/* =========================================================
   PROJECT QUESTION
========================================================= */

app.post(
    "/api/project/question",
    async (req, res) => {

        try {

            const {
                project,
                targetRole,
            } = req.body;

            const prompt = `

You are a technical interviewer conducting a placement simulation.

Target role:
${targetRole || "Software Developer"}

Candidate project:
${project || "A software development project"}

Generate one technical project-defense question.

The question should test:
- technical understanding
- architecture
- decisions
- problem solving

Return JSON:

{
  "question": "...",
  "difficulty": "Easy/Medium/Hard",
  "evaluationFocus": ["...", "..."]
}

`;

            const result =
                await generateAI(prompt);

            if (!result.success) {

                return res.json({

                    ...getDemoProjectQuestion(),

                    demoMode: true,

                });
            }

            return res.json({

                ...result.data,

                demoMode: false,

                model: result.model,

            });

        } catch (error) {

            console.error(
                "Project question error:",
                error
            );

            return res.status(500).json({

                message:
                    "Failed to generate project question.",

            });
        }
    }
);

/* =========================================================
   DEMO PROJECT EVALUATION
========================================================= */

function getDemoProjectEvaluation(answer) {

    const hasAnswer =
        answer &&
        answer.trim().length > 20;

    if (!hasAnswer) {

        return {

            score: 20,

            technicalDepth: 15,

            problemSolving: 20,

            communication: 25,

            feedback:
                "The answer needs more technical detail. Explain the problem, the approach you selected, why you selected it, and the final result.",

            strengths: [
                "Attempted to answer the question",
            ],

            improvements: [
                "Explain the technical problem clearly",
                "Describe your implementation",
                "Explain your technical decisions",
                "Mention the final outcome",
            ],

        };

    }

    return {

        score: 78,

        technicalDepth: 75,

        problemSolving: 80,

        communication: 80,

        feedback:
            "The answer demonstrates reasonable technical understanding. To perform better in a real interview, provide more specific implementation details and measurable outcomes.",

        strengths: [
            "Clear explanation",
            "Shows problem-solving ability",
            "Demonstrates technical ownership",
        ],

        improvements: [
            "Explain architecture in more detail",
            "Mention specific technologies",
            "Explain trade-offs",
            "Include measurable results",
        ],

    };
}

/* =========================================================
   PROJECT EVALUATION
========================================================= */

app.post(
    "/api/project/evaluate",
    async (req, res) => {

        try {

            const {
                question,
                answer,
                targetRole,
            } = req.body;

            const prompt = `

You are an AI technical interviewer.

This is a placement simulation.

Target role:
${targetRole || "Software Developer"}

Interview question:
${question}

Candidate answer:
${answer}

Evaluate the answer.

Give scores from 0 to 100 for:

- overall score
- technical depth
- problem solving
- communication

Also provide:

- feedback
- strengths
- improvements

Return JSON.

`;

            const result =
                await generateAI(prompt);

            if (!result.success) {

                return res.json({

                    ...getDemoProjectEvaluation(answer),

                    demoMode: true,

                });
            }

            return res.json({

                ...result.data,

                demoMode: false,

                model: result.model,

            });

        } catch (error) {

            console.error(
                "Project evaluation error:",
                error
            );

            return res.status(500).json({

                message:
                    "Failed to evaluate project answer.",

            });
        }
    }
);

/* =========================================================
   DEMO HR QUESTION
========================================================= */

function getDemoHRQuestion(questionNumber) {

    const demos = [
        {
            question: "Tell me about yourself and why you are interested in this role.",
            focus: ["Communication", "Motivation", "Role Fit"],
        },
        {
            question: "Describe a situation where you had to work under pressure to meet a deadline. What did you do?",
            focus: ["Behavioral Thinking", "Situational Thinking", "Confidence"],
        },
        {
            question: "What are your key strengths and how do they align with this position?",
            focus: ["Self-Awareness", "Role Fit", "Confidence"],
        },
        {
            question: "Describe a time you had a conflict with a teammate. How did you resolve it?",
            focus: ["Behavioral Thinking", "Communication", "Maturity"],
        },
        {
            question: "Where do you see yourself professionally in the next 3 to 5 years?",
            focus: ["Motivation", "Ambition", "Role Fit"],
        },
    ];

    const idx = Math.min(questionNumber - 1, demos.length - 1);

    return {
        question: demos[idx].question,
        focus: demos[idx].focus,
    };
}

/* =========================================================
   CONTENT-BASED FALLBACK HR EVALUATOR
   ─────────────────────────────────────────────────────────
   Used when Gemini models are unavailable.
   Scores are derived entirely from the actual answer content
   using natural language vocabulary verification, question
   topic relevance, action-oriented depth, and STAR behavioral
   coherence — NEVER static baseline numbers.
========================================================= */

const COMMON_ENGLISH_WORDS = new Set([
    "a", "about", "above", "across", "action", "actions", "activity", "actually",
    "admit", "after", "again", "against", "age", "ago", "agree", "agreed", "ahead",
    "all", "allow", "allowed", "almost", "alone", "along", "already", "also",
    "although", "always", "am", "among", "an", "and", "another", "answer", "answers",
    "any", "anyone", "anything", "anyway", "api", "apis", "app", "application",
    "apply", "approach", "are", "area", "around", "as", "ask", "asked", "assign",
    "assigned", "at", "attempt", "auth", "authentication", "away", "back", "backend",
    "bad", "balance", "base", "based", "basic", "basically", "be", "became", "because",
    "become", "been", "before", "began", "begin", "behavior", "behind", "believe",
    "best", "better", "between", "beyond", "big", "bit", "both", "branch", "break",
    "bring", "brought", "bug", "bugs", "build", "built", "business", "busy", "but",
    "by", "call", "called", "came", "can", "cannot", "can't", "capable", "care",
    "career", "case", "cases", "cause", "certain", "certainly", "challenge", "challenges",
    "change", "changed", "check", "checked", "choice", "choose", "clear", "clearly",
    "close", "code", "coding", "collaborate", "collaborated", "colleague", "colleagues",
    "college", "come", "communicate", "communicated", "communication", "company",
    "complete", "completed", "complex", "component", "confident", "confidence", "conflict",
    "conflicts", "connect", "consider", "continue", "contribute", "control", "conversation",
    "coordinate", "coordinated", "correct", "could", "course", "create", "created",
    "critical", "crunch", "current", "currently", "daily", "data", "database", "day",
    "days", "deadline", "deadlines", "deal", "decide", "decided", "decision", "decisions",
    "deep", "deliver", "delivered", "deploy", "deployed", "describe", "design", "designed",
    "detail", "details", "develop", "developed", "developer", "development", "did",
    "didn't", "different", "difficult", "difficulty", "direction", "directly", "discuss",
    "discussed", "discussion", "divide", "divided", "do", "does", "doesn't", "doing",
    "done", "don't", "down", "due", "during", "each", "early", "easy", "effective",
    "effectively", "effort", "either", "end", "ended", "engineer", "engineering", "enough",
    "ensure", "ensured", "entire", "environment", "error", "errors", "especially",
    "estimate", "even", "eventually", "ever", "every", "everyone", "everything",
    "example", "examples", "except", "execute", "executed", "experience", "explain",
    "explained", "face", "faced", "fact", "fail", "failed", "failing", "failure",
    "fast", "feature", "features", "feel", "few", "field", "fight", "figure", "figured",
    "final", "finally", "find", "finish", "finished", "first", "fit", "five", "fix",
    "fixed", "fixing", "flow", "focus", "focused", "follow", "followed", "for", "force",
    "forward", "found", "four", "framework", "free", "fresh", "friend", "from",
    "frontend", "full", "further", "future", "gain", "gave", "general", "get", "getting",
    "give", "given", "giving", "go", "goal", "goals", "goes", "going", "gone", "good",
    "got", "great", "group", "grow", "growth", "guide", "guided", "had", "handle",
    "handled", "handling", "happen", "happened", "hard", "has", "have", "having", "he",
    "head", "hear", "help", "helped", "helping", "her", "here", "herself", "high",
    "him", "himself", "his", "hold", "honest", "hope", "hour", "hours", "how", "however",
    "huge", "i", "idea", "identify", "identified", "if", "implement", "implemented",
    "important", "improve", "improved", "in", "include", "included", "including",
    "increase", "increased", "individual", "industry", "influence", "information",
    "initiative", "instead", "integrate", "integrated", "integration", "interest",
    "interested", "internship", "interview", "into", "investigate", "investigated",
    "involve", "involved", "is", "issue", "issues", "it", "item", "its", "itself",
    "job", "join", "joined", "just", "keep", "kept", "key", "kind", "knew", "know",
    "knowledge", "known", "lack", "language", "large", "last", "late", "later", "lead",
    "leader", "leadership", "learn", "learned", "learning", "least", "led", "less",
    "lesson", "let", "level", "like", "likely", "limit", "line", "listen", "listened",
    "little", "live", "logic", "long", "look", "looked", "looking", "lost", "lot",
    "low", "made", "main", "maintain", "major", "make", "making", "manage", "managed",
    "management", "manager", "many", "matter", "may", "maybe", "me", "mean", "meaning",
    "member", "members", "mention", "mentioned", "met", "metric", "metrics", "might",
    "mind", "mindset", "minute", "minutes", "miss", "mistake", "mistakes", "model",
    "month", "months", "more", "most", "mostly", "motivate", "motivation", "move",
    "moved", "much", "multiple", "must", "my", "myself", "name", "nature", "near",
    "nearly", "necessary", "need", "needed", "needs", "negative", "never", "new", "next",
    "nice", "night", "no", "nobody", "none", "nor", "normal", "not", "note", "noted",
    "nothing", "notice", "noticed", "now", "number", "numbers", "object", "objective",
    "obtain", "obviously", "occur", "off", "offer", "offered", "often", "ok", "okay",
    "old", "on", "once", "one", "ones", "only", "open", "opportunity", "option", "or",
    "order", "organize", "organized", "other", "others", "otherwise", "our", "ourselves",
    "out", "outcome", "outcomes", "output", "over", "overcome", "own", "owner",
    "ownership", "page", "part", "participate", "particular", "particularly", "pass",
    "passed", "passion", "past", "path", "patience", "patient", "people", "perform",
    "performance", "perhaps", "period", "person", "personal", "perspective", "pick",
    "plan", "planned", "planning", "point", "position", "positive", "possible", "potential",
    "practice", "prefer", "prepare", "prepared", "pressure", "pretty", "previous",
    "primarily", "primary", "principle", "prioritize", "prioritized", "priority", "problem",
    "problems", "process", "produce", "product", "program", "project", "projects",
    "proper", "properly", "provide", "provided", "purpose", "push", "put", "quality",
    "question", "questions", "quick", "quickly", "quite", "rather", "reach", "reached",
    "read", "ready", "real", "realistic", "really", "reason", "receive", "received",
    "recent", "recently", "recognize", "reduce", "reduced", "refactor", "regular",
    "relate", "release", "remain", "remaining", "remember", "remove", "report", "require",
    "required", "requirement", "requirements", "research", "resolve", "resolved",
    "resource", "resources", "respect", "respond", "responded", "response", "responsible",
    "responsibility", "rest", "result", "results", "review", "reviewed", "right", "role",
    "roles", "room", "round", "route", "run", "running", "safe", "same", "say", "saying",
    "scale", "scenario", "schedule", "scheduled", "school", "scope", "score", "second",
    "section", "see", "seem", "seemed", "select", "selected", "self", "send", "sense",
    "separate", "serve", "server", "service", "services", "session", "set", "several",
    "share", "shared", "she", "shift", "short", "should", "show", "showed", "side",
    "sign", "significant", "similar", "simple", "simply", "since", "single", "situation",
    "skill", "skills", "slow", "small", "so", "software", "solution", "solutions",
    "solve", "solved", "solving", "some", "someone", "something", "sometimes", "somewhat",
    "soon", "sorry", "sort", "sound", "source", "space", "speak", "special", "specific",
    "specifically", "spend", "spent", "split", "stack", "stage", "standard", "start",
    "started", "state", "statement", "step", "steps", "still", "stop", "strategy",
    "strength", "strengths", "strong", "structure", "structured", "student", "study",
    "submit", "submitted", "submission", "succeed", "success", "successful", "successfully",
    "such", "suggest", "suggested", "suggestion", "suit", "support", "supported", "sure",
    "surely", "system", "systems", "tackle", "tackled", "take", "taken", "taking", "talk",
    "talked", "target", "task", "tasks", "teach", "team", "teammate", "teammates", "teams",
    "technical", "technology", "tell", "term", "test", "tested", "testing", "tests",
    "than", "thank", "thanks", "that", "the", "their", "them", "themselves", "then",
    "theory", "there", "therefore", "these", "they", "thing", "things", "think", "third",
    "this", "thorough", "though", "thought", "three", "through", "throughout", "tight",
    "time", "timeline", "timely", "times", "to", "today", "together", "told", "too",
    "took", "tool", "tools", "top", "topic", "total", "toward", "towards", "track",
    "trade", "train", "trouble", "true", "truly", "try", "trying", "turn", "turned",
    "two", "type", "under", "understand", "understanding", "understood", "unit",
    "university", "unless", "until", "up", "update", "updated", "upon", "us", "use",
    "used", "useful", "user", "users", "using", "usual", "usually", "value", "values",
    "various", "very", "view", "wait", "want", "wanted", "was", "way", "ways", "we",
    "weakness", "weaknesses", "week", "weeks", "well", "went", "were", "what", "whatever",
    "when", "where", "whether", "which", "while", "white", "who", "whole", "whom", "whose",
    "why", "will", "willing", "win", "with", "within", "without", "word", "words", "work",
    "worked", "working", "works", "world", "worry", "would", "write", "writing", "written",
    "wrong", "year", "years", "yes", "yet", "you", "young", "your", "yourself"
]);

function isRecognizedWord(rawWord) {
    const w = rawWord.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return false;
    if (COMMON_ENGLISH_WORDS.has(w)) return true;
    const suffixes = ["ing", "ingly", "ed", "ly", "es", "s", "tion", "ment", "able", "ness", "ive", "al", "er", "est"];
    for (const suf of suffixes) {
        if (w.endsWith(suf) && w.length > suf.length + 2) {
            const root = w.slice(0, -suf.length);
            if (COMMON_ENGLISH_WORDS.has(root) || COMMON_ENGLISH_WORDS.has(root + "e")) {
                return true;
            }
        }
    }
    return false;
}

function cleanTokensFromText(str) {
    return String(str || "")
        .toLowerCase()
        .replace(/[^a-z0-9'\s-]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

function countMatchesInText(text, patterns) {
    return patterns.reduce((acc, p) => {
        const re = typeof p === "string" ? new RegExp(p, "i") : p;
        return acc + (re.test(text) ? 1 : 0);
    }, 0);
}

function getDemoHREvaluation(answer, question) {

    /* ── 0.  SAFETY & SANITIZATION ───────────────────────── */
    const safeAnswer = String(answer || "").trim();
    const safeQuestion = String(question || "").trim();

    // Empty answer
    if (!safeAnswer) {
        return {
            score: 0,
            communication: 0,
            relevance: 0,
            depth: 0,
            confidence: 0,
            feedback: "No answer was provided. Please articulate a complete response explaining your experience or viewpoint.",
            strengths: [],
            improvements: [
                "Provide a complete answer to the interview question",
                "Use the STAR method for behavioral questions",
                "Include specific examples and measurable outcomes"
            ],
            demoMode: true,
        };
    }

    const cleanTokens = cleanTokensFromText(safeAnswer);
    const wordCount = cleanTokens.length;

    // Meaningful vocabulary verification
    let recognizedCount = 0;
    for (const t of cleanTokens) {
        if (/^\d+$/.test(t) || isRecognizedWord(t)) {
            recognizedCount++;
        }
    }
    const recognizedRatio = wordCount > 0 ? recognizedCount / wordCount : 0;

    // Detect meaningless / gibberish text (e.g. "fegegrherherhersen")
    const hasLongGibberishToken = cleanTokens.some(t => {
        return t.length >= 10 && !isRecognizedWord(t) && !/^\d+$/.test(t);
    });
    const hasExcessiveRepetition = /(.)\1{3,}/i.test(safeAnswer);
    const isGibberish = (wordCount <= 3 && recognizedRatio < 0.5) ||
        (recognizedCount === 0) ||
        (wordCount > 3 && recognizedRatio < 0.3) ||
        (wordCount === 1 && hasLongGibberishToken) ||
        hasExcessiveRepetition;

    if (isGibberish) {
        const comm = Math.min(5, Math.max(0, Math.round(recognizedRatio * 10)));
        const rel = 0;
        const dep = 0;
        const conf = Math.min(5, Math.max(0, Math.round(recognizedRatio * 8)));
        const score = Math.round(comm * 0.25 + rel * 0.30 + dep * 0.25 + conf * 0.20);

        return {
            score,
            communication: comm,
            relevance: rel,
            depth: dep,
            confidence: conf,
            feedback: `The submitted response appears to be meaningless or gibberish ("${safeAnswer.slice(0, 35)}${safeAnswer.length > 35 ? "..." : ""}"). It does not address the question. In an HR interview, you must articulate a clear, professional response using coherent natural language.`,
            strengths: [],
            improvements: [
                "Provide a coherent, meaningful response in natural language",
                "Directly address the specific question asked by the interviewer",
                "Share relevant projects, experiences, or situational examples",
                "Structure your response with clear context, actions, and results"
            ],
            demoMode: true,
        };
    }

    // ── 1. NON-ANSWERS / REFUSALS ("I don't know", "no idea") ─
    const isNonAnswer = /^(i\s+)?(don'?t|do\s+not)\s+know\.?$/i.test(safeAnswer) ||
        /^(no\s+idea|not\s+sure|no\s+clue|i\s+have\s+no\s+idea|idk|none|nothing|n\/?a|na|skip|pass|can'?t\s+say|cannot\s+answer)\.?$/i.test(safeAnswer) ||
        (/^i (don'?t|do not) know/i.test(safeAnswer) && wordCount <= 5);

    if (isNonAnswer) {
        const comm = 12;
        const rel = 4;
        const dep = 0;
        const conf = 6;
        const score = Math.round(comm * 0.25 + rel * 0.30 + dep * 0.25 + conf * 0.20);

        return {
            score,
            communication: comm,
            relevance: rel,
            depth: dep,
            confidence: conf,
            feedback: "You indicated that you do not know or chose not to provide an answer. In an HR interview, even when facing an unfamiliar situation, demonstrate a problem-solving mindset by explaining how you would approach the scenario, or share a related academic or team experience.",
            strengths: ["Acknowledged the question directly"],
            improvements: [
                "Attempt to answer behavioral questions using hypothetical approaches if you lack direct experience",
                "Prepare standard HR questions (teamwork, deadlines, conflicts) in advance",
                "Highlight transferable skills and eagerness to learn"
            ],
            demoMode: true,
        };
    }

    // ── 2. CURT / TOO BRIEF ANSWERS ("Yes, I agree") ────────
    const isCurtAnswer = /^(yes|no|yeah|nope|sure|ok|okay|fine|i\s+agree|yes,?\s+i\s+agree|agreed|maybe|certainly)\.?$/i.test(safeAnswer) ||
        (wordCount <= 3 && /^(yes|i agree|agreed|sure|ok)\b/i.test(safeAnswer));

    if (isCurtAnswer) {
        const comm = 18;
        const rel = 14;
        const dep = 6;
        const conf = 16;
        const score = Math.round(comm * 0.25 + rel * 0.30 + dep * 0.25 + conf * 0.20);

        return {
            score,
            communication: comm,
            relevance: rel,
            depth: dep,
            confidence: conf,
            feedback: "The response is too brief to evaluate your competencies. HR interview questions require detailed explanations, personal reasoning, and illustrative examples to demonstrate your cultural and professional fit.",
            strengths: ["Provided a direct initial stance"],
            improvements: [
                "Elaborate on why you hold that view or decision",
                "Share a specific example from your projects or coursework illustrating your point",
                "Provide a structured narrative rather than a brief statement"
            ],
            demoMode: true,
        };
    }

    // ── 3. SUBSTANTIVE ANSWER EVALUATION ────────────────────
    const lowerAnswer = safeAnswer.toLowerCase();
    const lowerQuestion = safeQuestion.toLowerCase();
    const sentences = safeAnswer.split(/[.!?]+/).filter(s => s.trim().length > 3);
    const sentCount = sentences.length;

    // ── A. RELEVANCE (0-100) ────────────────────────────────
    let relevance = 0;

    const questionThemes = [
        {
            name: "deadline",
            trigger: /deadline|pressure|tight schedule|time crunch|urgent|timeline|stress|under pressure/i,
            signals: [/deadline/i, /pressure/i, /time/i, /schedule/i, /complete/i, /submit/i,
                /submitted/i, /manage/i, /prioriti/i, /urgent/i, /days?\b/i, /hours?\b/i,
                /on time/i, /remaining/i, /timeline/i, /fast/i, /rush/i]
        },
        {
            name: "teamwork",
            trigger: /team|teammate|conflict|disagree|group|collaborat|partner|colleague|resolve/i,
            signals: [/team/i, /teammates?/i, /collaborat/i, /divided/i, /communicat/i, /resolve/i,
                /discussion/i, /approach/i, /together/i, /everyone/i, /listened/i, /share/i,
                /helped/i, /support/i]
        },
        {
            name: "problem_solving",
            trigger: /problem|challenge|difficult|failure|failed|mistake|bug|issue|obstacle|debug/i,
            signals: [/problem/i, /issue/i, /bug/i, /challeng/i, /debug/i, /fix/i, /fixed/i,
                /identified/i, /solv/i, /root cause/i, /failing/i, /solution/i, /tested/i,
                /investigat/i, /resolv/i]
        },
        {
            name: "project_experience",
            trigger: /project|built|develop|role|experience|work|describe a time/i,
            signals: [/project/i, /built/i, /develop/i, /backend/i, /frontend/i, /api/i, /database/i,
                /code/i, /system/i, /application/i, /app/i, /task/i, /responsib/i, /feature/i,
                /college/i, /coursework/i, /internship/i]
        },
        {
            name: "self_awareness",
            trigger: /tell me about yourself|introduce|background|strength|weakness|future|goal/i,
            signals: [/i am\b/i, /my name/i, /i study/i, /strength/i, /weakness/i, /improve/i,
                /goal/i, /future/i, /aspire/i, /career/i, /passionate/i, /learn/i, /skill/i]
        }
    ];

    let matchedThemes = 0;
    let themeSignalMatches = 0;

    for (const qt of questionThemes) {
        if (qt.trigger.test(lowerQuestion)) {
            matchedThemes++;
            for (const sig of qt.signals) {
                if (sig.test(lowerAnswer)) {
                    themeSignalMatches++;
                }
            }
        }
    }

    const qContentWords = cleanTokensFromText(safeQuestion).filter(w =>
        w.length > 3 && !/^(what|when|where|which|who|whom|whose|why|how|tell|about|time|have|your|with|from|that|this|were|been)$/i.test(w)
    );
    let directOverlap = 0;
    for (const qw of qContentWords) {
        if (lowerAnswer.includes(qw)) {
            directOverlap++;
        }
    }

    if (matchedThemes > 0) {
        relevance = 15;
        relevance += Math.min(themeSignalMatches * 8, 48);
        relevance += Math.min(directOverlap * 10, 25);
        if (themeSignalMatches >= 2) relevance += 8;
    } else {
        relevance = 25;
        relevance += Math.min(directOverlap * 12, 40);
    }

    const hasContextSetting = /\b(during|when i|in my|at my|while working|we had|i had)\b/i.test(lowerAnswer);
    if (hasContextSetting) relevance += 8;

    if (matchedThemes > 0 && themeSignalMatches === 0 && directOverlap === 0) {
        relevance = Math.min(relevance, 18);
    }

    relevance = Math.max(5, Math.min(96, relevance));

    // ── B. DEPTH (0-100) ────────────────────────────────────
    let depth = 10;

    const actionVerbs = countMatchesInText(safeAnswer, [
        /\bi (took|took responsibility|divided|handled|debugged|fixed|tested|identified|built|developed|implemented|designed|created|resolved|led|managed|coordinated|communicated|organized|analyzed|decided|submitted|delivered|refactored|optimized)\b/i,
        /\b(divided the work|fixed an?|debugged the|tested the|identified the|built a|implemented a|took responsibility|submitted it)\b/i,
    ]);
    depth += Math.min(actionVerbs * 9, 32);

    const concreteEntities = countMatchesInText(safeAnswer, [
        /\b(api|apis|backend|frontend|database|auth|authentication|integration|server|endpoint|pipeline|architecture)\b/i,
        /\b(bug|issue|deadline|project|teammates?|flow|submission|unit test|test cases?|codebase)\b/i,
    ]);
    depth += Math.min(concreteEntities * 6, 24);

    const hasMetrics = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(days?|hours?|weeks?|months?|percent|%|members?|users?)\b/i.test(safeAnswer) ||
        /\b\d+\b/.test(safeAnswer);
    if (hasMetrics) depth += 12;

    const outcomeMatches = countMatchesInText(safeAnswer, [
        /\b(successfully|submitted it on time|submitted on time|on time|completed on time|resolved the issue|fixed it|delivered on time|achieved|passed all tests)\b/i,
        /\b(result was|the outcome was|as a result|in the end|finally completed)\b/i,
    ]);
    depth += Math.min(outcomeMatches * 8, 20);

    if (wordCount >= 20) depth += 6;
    if (wordCount >= 40) depth += 8;
    if (wordCount >= 70) depth += 6;

    depth = Math.max(5, Math.min(95, depth));

    // ── C. COMMUNICATION (0-100) ────────────────────────────
    let communication = 20;

    if (wordCount >= 15) communication += 12;
    if (wordCount >= 30) communication += 14;
    if (wordCount >= 60) communication += 10;
    if (wordCount >= 90) communication += 6;

    if (sentCount >= 2) communication += 8;
    if (sentCount >= 3) communication += 6;

    const connectorCount = countMatchesInText(safeAnswer, [
        /\b(and|because|therefore|as a result|so that|which|meanwhile|additionally|furthermore|eventually|before|after|finally|specifically)\b/i
    ]);
    communication += Math.min(connectorCount * 4, 16);

    const uniqueTokens = new Set(cleanTokens);
    const diversityRatio = uniqueTokens.size / wordCount;
    if (diversityRatio >= 0.65 && wordCount >= 15) communication += 8;

    const fillers = countMatchesInText(safeAnswer, [
        /\bi (don'?t|do not) know\b/i, /\bsomehow\b/i, /\bum+\b/i, /\buh+\b/i,
        /\blike,? like\b/i, /\bbasically basically\b/i, /\bi guess\b/i
    ]);
    communication -= fillers * 6;

    communication = Math.max(10, Math.min(96, communication));

    // ── D. CONFIDENCE (0-100) ───────────────────────────────
    let confidence = 20;

    const firstPersonCount = countMatchesInText(safeAnswer, [
        /\bi (took|handled|debugged|fixed|divided|decided|led|built|solved|ensured|managed|initiated|identified|tested)\b/i,
        /\b(my responsibility|my part|my role|i was responsible)\b/i
    ]);
    confidence += Math.min(firstPersonCount * 10, 30);

    const assertiveCount = countMatchesInText(safeAnswer, [
        /\b(successfully|confident|capable|ensured|achieved|proactive|resolved|on time|committed)\b/i
    ]);
    confidence += Math.min(assertiveCount * 7, 21);

    const hasTeamAndIndividual = /\b(we|our|team|teammates)\b/i.test(safeAnswer) && /\bi\b/i.test(safeAnswer);
    if (hasTeamAndIndividual) confidence += 10;
    if (actionVerbs >= 2) confidence += 10;
    if (actionVerbs >= 4) confidence += 8;

    const hedges = countMatchesInText(safeAnswer, [
        /\b(maybe|perhaps|sort of|kind of|somehow|i guess|probably|not sure)\b/i
    ]);
    confidence -= hedges * 6;

    if (wordCount >= 25) confidence += 8;

    confidence = Math.max(10, Math.min(95, confidence));

    // ── E. STAR BONUS (Behavioral) ──────────────────────────
    const isBehavioral = /deadline|pressure|conflict|team|situation|time you|describe a|tell me about/i.test(safeQuestion);
    let starCount = 0;
    if (isBehavioral) {
        const hasS = /\b(during|when|project|had a|faced|deadline|in college|there was)\b/i.test(safeAnswer);
        const hasT = /\b(responsible|role|task|had to|needed to|responsibility|deadline was|goal)\b/i.test(safeAnswer);
        const hasA = /\b(divided|debugged|fixed|tested|handled|implemented|communicated|investigated|identified)\b/i.test(safeAnswer);
        const hasR = /\b(submitted|completed|on time|successfully|resolved|delivered|result|outcome)\b/i.test(safeAnswer);

        starCount = [hasS, hasT, hasA, hasR].filter(Boolean).length;
        if (starCount === 4) {
            communication = Math.min(98, communication + 6);
            relevance = Math.min(98, relevance + 6);
            depth = Math.min(98, depth + 8);
            confidence = Math.min(98, confidence + 6);
        } else if (starCount === 3) {
            communication = Math.min(98, communication + 3);
            relevance = Math.min(98, relevance + 4);
            depth = Math.min(98, depth + 4);
            confidence = Math.min(98, confidence + 3);
        }
    }

    // ── F. SCORE CALCULATION ────────────────────────────────
    const score = Math.round(
        communication * 0.25 +
        relevance * 0.30 +
        depth * 0.25 +
        confidence * 0.20
    );

    // ── G. CONTEXTUAL FEEDBACK ──────────────────────────────
    const strengthsList = [];
    const improvementsList = [];

    if (themeSignalMatches >= 2 || directOverlap >= 2) strengthsList.push("Directly addressed the core themes of the question");
    if (actionVerbs >= 2) strengthsList.push("Demonstrated clear personal ownership with specific action verbs");
    if (outcomeMatches >= 1) strengthsList.push("Highlighted a positive and measurable outcome (delivered on time)");
    if (starCount >= 3) strengthsList.push("Structured the response effectively using the STAR method");
    if (hasMetrics) strengthsList.push("Used specific timeframes/numbers to ground the experience");
    if (communication >= 75) strengthsList.push("Articulated thoughts clearly with good sentence flow");
    if (strengthsList.length === 0) strengthsList.push("Provided a relevant baseline response");

    if (starCount < 3 && isBehavioral) improvementsList.push("Apply the full STAR structure: Situation → Task → Action → Result");
    if (!hasMetrics) improvementsList.push("Include specific numbers, metrics, or timelines (e.g., '3 days', '4 team members')");
    if (actionVerbs < 2) improvementsList.push("Use more first-person action verbs to highlight your individual contributions ('I debugged', 'I resolved')");
    if (outcomeMatches === 0) improvementsList.push("Explicitly state the final result and impact of your work");
    if (wordCount < 40) improvementsList.push("Elaborate on technical challenges faced and how you overcame them");
    if (improvementsList.length === 0) improvementsList.push("Continue leveraging this structured, example-rich approach in live interviews");

    let feedbackText = "";
    if (score >= 82) {
        feedbackText = "Outstanding answer with excellent STAR structure, clear personal ownership, and concrete problem-solving evidence.";
    } else if (score >= 68) {
        feedbackText = "Good response that clearly addresses the question with relevant actions and positive outcomes.";
    } else if (score >= 50) {
        feedbackText = "Reasonable response covering the main points, but could be strengthened by adding deeper technical details and specific metrics.";
    } else {
        feedbackText = "The response is relatively brief or lacks specificity. Focus on framing your answer with a concrete scenario, your exact role, actions taken, and the measurable result.";
    }

    return {
        score,
        communication,
        relevance,
        depth,
        confidence,
        feedback: feedbackText,
        strengths: strengthsList.slice(0, 3),
        improvements: improvementsList.slice(0, 3),
        demoMode: true,
    };
}

/* =========================================================
   HR QUESTION ENDPOINT
========================================================= */

app.post(
    "/api/hr/question",
    async (req, res) => {

        try {

            const {
                resumeText,
                candidateProfile,
                questionNumber,
                previousQuestions,
            } = req.body;

            const name = candidateProfile?.name || "the candidate";
            const role = candidateProfile?.role || "Software Developer";
            // skills may arrive as a comma-string OR as an array — handle both
            const skills = Array.isArray(candidateProfile?.skills)
                ? candidateProfile.skills.join(", ")
                : String(candidateProfile?.skills || "");
            const branch = candidateProfile?.branch || "Engineering";
            const college = candidateProfile?.college || "college";

            // previousQuestions may arrive as an array OR undefined — always treat as array
            const safePrevQs = Array.isArray(previousQuestions) ? previousQuestions : [];
            const safeQNum = Number(questionNumber) || 1;

            const prevList = safePrevQs.length
                ? `\nAvoid repeating these questions already asked:\n${safePrevQs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
                : "";

            const prompt = `
You are an experienced HR interviewer conducting the HR round of a placement simulation for ANVESH.

Candidate name: ${name}
Target role: ${role}
Branch/Major: ${branch}
College: ${college}
Skills: ${skills}

Resume excerpt:
${(resumeText || "").slice(0, 800)}

This is question ${safeQNum} of 5 in the HR interview.

${prevList}

Generate ONE HR interview question that tests one of these areas:
- Communication and articulation
- Motivation and career goals
- Behavioral thinking (STAR situations)
- Confidence and self-awareness
- Role and company fit
- Situational/problem-solving mindset

The question should be personalized based on the candidate's profile and target role.
Do NOT ask a technical question.

Return JSON:

{
  "question": "...",
  "focus": ["...", "..."]
}
`;

            const result = await generateAI(prompt);

            if (!result.success) {

                return res.json({
                    ...getDemoHRQuestion(questionNumber),
                    demoMode: true,
                });
            }

            return res.json({
                ...result.data,
                demoMode: false,
                model: result.model,
            });

        } catch (error) {

            console.error("HR question error:", error);

            return res.status(500).json({
                message: "Failed to generate HR question.",
            });
        }
    }
);

/* =========================================================
   HR EVALUATE ENDPOINT
========================================================= */

app.post(
    "/api/hr/evaluate",
    async (req, res) => {

        try {

            const {
                question,
                answer,
                candidateProfile,
                targetRole,
            } = req.body;

            // Guard: answer must be a non-empty string — return demo if missing
            const safeAnswer = String(answer || "").trim();
            const safeQuestion = String(question || "HR interview question").trim();
            if (!safeAnswer) {
                return res.json({
                    ...getDemoHREvaluation("", safeQuestion),
                    demoMode: true,
                });
            }

            const role = targetRole || candidateProfile?.role || "Software Developer";

            const prompt = `
You are an experienced HR interviewer evaluating a candidate's response in a placement simulation for ANVESH.

Target role: ${role}

HR Interview question:
${safeQuestion}

Candidate's answer:
${safeAnswer}

CRITICAL SCORING AND EVALUATION RULES:
1. GIBBERISH / MEANINGLESS / KEYBOARD MASH:
   If the answer consists of random letters, nonsense strings (e.g. "fegegrherherhersen"), unrelated spam, or has no coherent English meaning:
   - communication: 0-10
   - relevance: 0-5
   - depth: 0-5
   - confidence: 0-10
   - feedback: Explicitly explain that the response is meaningless/gibberish and completely off-topic.
   - strengths: []
   - improvements: ["Provide a coherent answer in natural English", "Directly address the question asked"]

2. NON-ANSWERS / REFUSALS:
   If the candidate says "I don't know", "no idea", "not sure", "pass", or similar:
   - communication: 10-15
   - relevance: 0-10
   - depth: 0-5
   - confidence: 5-15
   - feedback: Explain that the candidate did not provide an answer.

3. CURT / TOO BRIEF ANSWERS:
   If the answer is a brief statement like "yes", "I agree", "maybe" without explanation:
   - All sub-scores must be between 10 and 25.

4. SUBSTANTIVE ANSWERS:
   Score objectively 0-100:
   - communication: clarity, articulation, logical structure, grammatical quality
   - relevance: how directly and specifically it answers this particular question
   - depth: specific examples, STAR structure, concrete actions taken, metrics, final outcomes
   - confidence: first-person ownership ("I took", "I resolved"), conviction, assertiveness

Return JSON:

{
  "communication": 0-100,
  "relevance": 0-100,
  "depth": 0-100,
  "confidence": 0-100,
  "feedback": "...",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."]
}
`;

            const result = await generateAI(prompt);

            if (!result.success) {

                return res.json({
                    ...getDemoHREvaluation(safeAnswer, safeQuestion),
                    demoMode: true,
                });
            }

            // Compute weighted overall score from Gemini sub-scores
            const geminiData = result.data || {};
            const comm = Math.max(0, Math.min(100, Math.round(Number(geminiData.communication) || 0)));
            const rel = Math.max(0, Math.min(100, Math.round(Number(geminiData.relevance) || 0)));
            const dep = Math.max(0, Math.min(100, Math.round(Number(geminiData.depth) || 0)));
            const conf = Math.max(0, Math.min(100, Math.round(Number(geminiData.confidence) || 0)));

            const geminiScore = Math.round(
                comm * 0.25 +
                rel * 0.30 +
                dep * 0.25 +
                conf * 0.20
            );

            return res.json({
                score: geminiScore,
                communication: comm,
                relevance: rel,
                depth: dep,
                confidence: conf,
                feedback: String(geminiData.feedback || "Evaluation completed."),
                strengths: Array.isArray(geminiData.strengths) ? geminiData.strengths : [],
                improvements: Array.isArray(geminiData.improvements) ? geminiData.improvements : [],
                demoMode: false,
                model: result.model,
            });

        } catch (error) {

            console.error("HR evaluate error:", error);

            return res.status(500).json({
                message: "Failed to evaluate HR answer.",
            });
        }
    }
);

/* =========================================================
   DEMO FINAL DECISION FALLBACK
========================================================= */

function getDemoFinalDecision(candidateProfile, resumeAnalysis, aptitudeResult, projectResults, hrResult) {

    const role = candidateProfile?.role || "Software Developer";
    const name = candidateProfile?.name || "the candidate";

    // Collect real scores where available, fall back to mid-range defaults
    const resumeScore = Number(resumeAnalysis?.atsScore || resumeAnalysis?.roleMatch) || 70;
    const aptScore = Number(
        typeof aptitudeResult?.percentage === "number" ? aptitudeResult.percentage
            : typeof aptitudeResult?.score === "number" ? aptitudeResult.score
                : 62
    );
    const projectScore = Number(typeof projectResults?.score === "number" ? projectResults.score : 72);
    const hrScore = Number(typeof hrResult?.overallScore === "number" ? hrResult.overallScore : 65);

    const overallScore = Math.round((resumeScore + aptScore + projectScore + hrScore) / 4);
    const decision = overallScore >= 60 ? "SHORTLISTED" : "NOT SHORTLISTED";

    return {
        decision,
        overallScore,
        placementReadiness: overallScore,
        recruiterSummary:
            `Based on this simulation, ${name} shows ${overallScore >= 70 ? "strong" : "moderate"} readiness for the ${role} role. ` +
            `Resume screening and project defense were notable stages. ` +
            `${overallScore >= 65 ? "Communication and project clarity were highlights." : "Aptitude and HR communication are areas that need improvement before a real interview."} ` +
            `This is a simulated recruiter assessment for training purposes only.`,
        strengths: [
            "Demonstrated relevant technical skills on resume",
            "Completed all simulation rounds",
            "Showed ability to explain project work",
        ],
        gaps: [
            overallScore < 70 ? "Aptitude performance needs strengthening" : "Could improve depth in technical explanations",
            "HR behavioral answers could benefit from more STAR structure",
            "Consider adding measurable outcomes to project descriptions",
        ],
        recommendations: [
            "Practice 3 timed aptitude sets per week",
            "Prepare STAR-based answers for top 10 behavioral HR questions",
            "Improve project explanation with architecture and trade-off details",
            "Strengthen DSA fundamentals for technical rounds",
        ],
        roundBreakdown: [
            { stage: "Resume Screening", score: resumeScore, interpretation: resumeScore >= 75 ? "Strong" : "Needs Improvement" },
            { stage: "Aptitude", score: aptScore, interpretation: aptScore >= 70 ? "Strong" : "Needs Improvement" },
            { stage: "Project Defense", score: projectScore, interpretation: projectScore >= 75 ? "Strong" : "Needs Improvement" },
            { stage: "HR Interview", score: hrScore, interpretation: hrScore >= 70 ? "Good Communication" : "Needs Practice" },
        ],
        simulationNote: "This result was generated using Anvesh Demo AI because the Gemini API quota is currently unavailable.",
        demoMode: true,
    };
}

/* =========================================================
   FINAL DECISION ENDPOINT
========================================================= */

app.post(
    "/api/decision/final",
    async (req, res) => {

        try {

            const {
                candidateProfile = {},
                resumeAnalysis = {},
                aptitudeResult = {},
                projectResults = {},
                hrResult = {},
                resumeText = "",
            } = req.body || {};

            const name = candidateProfile?.name || "the candidate";
            const role = candidateProfile?.role || "Software Developer";
            const skillsRaw = candidateProfile?.skills;
            const skills = Array.isArray(skillsRaw)
                ? skillsRaw.join(", ")
                : String(skillsRaw || "");

            // Extract numeric scores safely
            const resumeScore = Number(resumeAnalysis?.atsScore || resumeAnalysis?.roleMatch) || "N/A";
            const aptScore = typeof aptitudeResult?.percentage === "number"
                ? aptitudeResult.percentage
                : (typeof aptitudeResult?.score === "number" ? aptitudeResult.score : "N/A");
            const projectScore = typeof projectResults?.score === "number" ? projectResults.score : "N/A";
            const hrScore = typeof hrResult?.overallScore === "number" ? hrResult.overallScore : "N/A";

            const prompt = `
You are an AI recruiter for a placement simulation platform called ANVESH.

Your task is to give a SIMULATED final placement decision based on the candidate's performance across the simulation stages.

IMPORTANT: This is a SIMULATION for educational/training purposes. Do not claim this represents a real company's hiring decision.

CANDIDATE PROFILE:
Name: ${name}
Target Role: ${role}
Skills: ${skills}
Branch: ${candidateProfile?.branch || "Engineering"}
CGPA: ${candidateProfile?.cgpa || "N/A"}

SIMULATION ROUND SCORES:
Resume Screening Score: ${resumeScore}
Aptitude Score: ${aptScore}
Project Defense Score: ${projectScore}
HR Interview Score: ${hrScore}

HR INTERVIEW DETAIL:
Communication: ${hrResult?.communication || "N/A"}
Confidence: ${hrResult?.confidence || "N/A"}
Depth: ${hrResult?.depth || "N/A"}
Relevance: ${hrResult?.relevance || "N/A"}

RESUME EXCERPT:
${String(resumeText || "").slice(0, 600)}

Based on ALL of the above, provide a simulated recruiter decision.

Return ONLY valid JSON with this exact structure:

{
  "decision": "SHORTLISTED" or "NOT SHORTLISTED",
  "overallScore": 0-100,
  "placementReadiness": 0-100,
  "recruiterSummary": "2-3 sentence professional summary explaining the decision",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap 1", "gap 2", "gap 3"],
  "recommendations": ["action 1", "action 2", "action 3", "action 4"],
  "roundBreakdown": [
    { "stage": "Resume Screening", "score": 0-100, "interpretation": "short phrase" },
    { "stage": "Aptitude",         "score": 0-100, "interpretation": "short phrase" },
    { "stage": "Project Defense",  "score": 0-100, "interpretation": "short phrase" },
    { "stage": "HR Interview",     "score": 0-100, "interpretation": "short phrase" }
  ]
}
`;

            const result = await generateAI(prompt);

            if (!result.success) {

                console.log("⚠️ Gemini unavailable for final decision — using demo fallback.");

                return res.json(
                    getDemoFinalDecision(
                        candidateProfile,
                        resumeAnalysis,
                        aptitudeResult,
                        projectResults,
                        hrResult
                    )
                );
            }

            return res.json({
                ...result.data,
                demoMode: false,
                model: result.model,
            });

        } catch (error) {

            console.error("Final decision error:", error);

            return res.status(500).json({
                message: "Failed to generate final decision.",
                error: error.message,
            });
        }
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );

        res.status(500).json({

            message:
                error.message ||
                "Something went wrong.",

        });

    }
);

/* =========================================================
   START SERVER
========================================================= */

let server;

if (require.main === module) {
    server = app.listen(
        PORT,
        (err) => {
            if (err) {
                if (err.code === "EADDRINUSE") {
                    console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
                    console.error(`   To free port ${PORT} in PowerShell, run:`);
                    console.error(`   Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess | Stop-Process -Force`);
                    console.error(`   Or start on a different port: $env:PORT=5001; node server.js\n`);
                } else {
                    console.error("\n❌ Server failed to start:", err);
                }
                process.exit(1);
            }

            console.log("\n=================================");
            console.log("🚀 ANVESH BACKEND");
            console.log("=================================");
            console.log(
                `Server: http://localhost:${PORT}`
            );
            console.log(
                "Resume upload: READY"
            );
            console.log(
                "AI analysis: READY"
            );
            console.log(
                "Demo fallback: ENABLED"
            );
            console.log(
                "=================================\n"
            );

        }
    );

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
            console.error(`   To free port ${PORT} in PowerShell, run:`);
            console.error(`   Get-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess | Stop-Process -Force\n`);
        } else {
            console.error("\n❌ Server error:", err);
        }
        process.exit(1);
    });
}

module.exports = { app, server, validateResumeContent, extractSkillsFromResume, getDemoResumeAnalysis };