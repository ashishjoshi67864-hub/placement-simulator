import { useEffect, useState } from "react";

const TOTAL_QUESTIONS = 5;

function ProjectDefense({ onContinue }) {
    const [question, setQuestion] = useState(null);
    const [questionNumber, setQuestionNumber] = useState(1);

    const [answer, setAnswer] = useState("");

    const [loadingQuestion, setLoadingQuestion] =
        useState(true);

    const [evaluating, setEvaluating] =
        useState(false);

    const [evaluation, setEvaluation] =
        useState(null);

    const [results, setResults] = useState([]);

    const [finished, setFinished] = useState(false);

    const [error, setError] = useState("");

    // ==========================================
    // GET STORED DATA
    // ==========================================

    const resumeText =
        sessionStorage.getItem("resumeText");

    const candidateProfile = JSON.parse(
        sessionStorage.getItem(
            "candidateProfile"
        ) || "{}"
    );

    // ==========================================
    // LOAD PROJECT QUESTION
    // ==========================================

    async function loadQuestion(number) {
        setLoadingQuestion(true);
        setEvaluation(null);
        setAnswer("");
        setError("");

        try {
            const response = await fetch(
                "http://localhost:5000/api/project/question",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify({
                        resumeText: resumeText,

                        targetRole:
                            candidateProfile.role,

                        questionNumber: number,

                        previousQuestions:
                            results.map(
                                (item) =>
                                    item.question
                            ),
                    }),
                }
            );

            const data =
                await response.json();

            console.log(
                "Project question response:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Could not generate project question."
                );
            }

            setQuestion(
                data.question
            );
        } catch (error) {
            console.error(
                "Project question error:",
                error
            );

            setError(
                error.message ||
                "Could not generate project question."
            );
        } finally {
            setLoadingQuestion(false);
        }
    }

    // ==========================================
    // LOAD FIRST QUESTION
    // ==========================================

    useEffect(() => {
        if (!resumeText) {
            setError(
                "Resume information not found. Please restart the simulation."
            );

            setLoadingQuestion(false);

            return;
        }

        loadQuestion(1);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ==========================================
    // SUBMIT ANSWER
    // ==========================================

    async function submitAnswer() {
        if (!answer.trim()) {
            setError(
                "Please answer the question before continuing."
            );

            return;
        }

        if (!question) {
            return;
        }

        setEvaluating(true);
        setError("");

        try {
            const response = await fetch(
                "http://localhost:5000/api/project/evaluate",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify({
                        projectName:
                            question.projectName,

                        question:
                            question.question,

                        answer: answer,

                        targetRole:
                            candidateProfile.role,

                        resumeText: resumeText,
                    }),
                }
            );

            const data =
                await response.json();

            console.log(
                "Project evaluation response:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Could not evaluate project answer."
                );
            }

            const newResult = {
                projectName:
                    question.projectName,

                question:
                    question.question,

                category:
                    question.category,

                difficulty:
                    question.difficulty,

                skillTested:
                    question.skillTested,

                answer: answer,

                evaluation:
                    data.evaluation,
            };

            const updatedResults = [
                ...results,
                newResult,
            ];

            setResults(
                updatedResults
            );

            setEvaluation(
                data.evaluation
            );

            // Save after every question
            sessionStorage.setItem(
                "projectResults",
                JSON.stringify(
                    updatedResults
                )
            );

            console.log(
                "Project defense answer evaluated successfully!"
            );
        } catch (error) {
            console.error(
                "Project evaluation error:",
                error
            );

            setError(
                error.message ||
                "Could not evaluate your answer."
            );
        } finally {
            setEvaluating(false);
        }
    }

    // ==========================================
    // NEXT QUESTION
    // ==========================================

    function nextQuestion() {
        if (
            questionNumber >=
            TOTAL_QUESTIONS
        ) {
            setFinished(true);

            return;
        }

        const nextNumber =
            questionNumber + 1;

        setQuestionNumber(
            nextNumber
        );

        loadQuestion(
            nextNumber
        );
    }

    // ==========================================
    // CALCULATE FINAL SCORE
    // ==========================================

    function getFinalScore() {
        if (!results.length) {
            return 0;
        }

        const total =
            results.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.evaluation
                            ?.totalScore || 0
                    ),
                0
            );

        const maximum =
            results.length * 40;

        if (!maximum) {
            return 0;
        }

        return Math.round(
            (total / maximum) * 100
        );
    }

    // ==========================================
    // PERFORMANCE MESSAGE
    // ==========================================

    function getPerformance(score) {
        if (score >= 85) {
            return {
                title:
                    "Excellent Project Defense",

                description:
                    "You demonstrated strong project ownership, technical depth and problem-solving ability.",
            };
        }

        if (score >= 70) {
            return {
                title:
                    "Strong Project Understanding",

                description:
                    "You understand your projects well, with a few areas that could use deeper technical explanation.",
            };
        }

        if (score >= 50) {
            return {
                title:
                    "Moderate Project Understanding",

                description:
                    "You understand the general idea of your projects, but your technical depth needs more work.",
            };
        }

        return {
            title:
                "Project Knowledge Needs Improvement",

            description:
                "Your answers suggest that you need stronger technical understanding of the projects listed on your resume.",
        };
    }

    // ==========================================
    // FINAL RESULT PAGE
    // ==========================================

    if (finished) {
        const finalScore =
            getFinalScore();

        const performance =
            getPerformance(
                finalScore
            );

        return (
            <div className="project-page">

                <div className="project-container">

                    <div className="project-result">

                        <p className="tagline">
                            STEP 05 — PROJECT DEFENSE RESULT
                        </p>

                        <h1>
                            Here's how you defended your work.
                        </h1>

                        <p className="project-description">
                            Anvesh evaluated your project
                            understanding, technical depth,
                            ownership and problem solving.
                        </p>

                        {/* SCORE CIRCLE */}

                        <div className="project-score-circle">

                            <div className="project-big-score">

                                {finalScore}

                                <span>
                                    /100
                                </span>

                            </div>

                            <p>
                                Project Defense Score
                            </p>

                        </div>

                        {/* PERFORMANCE */}

                        <div className="project-performance-card">

                            <p className="section-label">
                                PROJECT ASSESSMENT
                            </p>

                            <h2>
                                {performance.title}
                            </h2>

                            <p>
                                {performance.description}
                            </p>

                        </div>

                        {/* QUESTION BREAKDOWN */}

                        <div className="project-breakdown">

                            {results.map(
                                (item, index) => (

                                    <div
                                        className="project-question-result"
                                        key={index}
                                    >

                                        <div>

                                            <span>
                                                QUESTION{" "}
                                                {index + 1}
                                            </span>

                                            <h3>
                                                {item.projectName}
                                            </h3>

                                            <p>
                                                {item.question}
                                            </p>

                                        </div>

                                        <strong>
                                            {
                                                item.evaluation
                                                    ?.totalScore || 0
                                            }
                                            /40
                                        </strong>

                                    </div>

                                )
                            )}

                        </div>

                        {/* CONTINUE */}

                        <button
                            className="primary-button"
                            onClick={onContinue}
                        >
                            Continue to HR Interview →
                        </button>

                    </div>

                </div>

            </div>
        );
    }

    // ==========================================
    // LOADING SCREEN
    // ==========================================

    if (
        loadingQuestion ||
        !question
    ) {
        return (
            <div className="project-page">

                <div className="project-container">

                    <div className="project-loading">

                        <p className="tagline">
                            STEP 05 — AI PROJECT DEFENSE
                        </p>

                        <div className="project-loading-orb">
                            AI
                        </div>

                        <h1>
                            Anvesh is studying your projects.
                        </h1>

                        <p>
                            Preparing a question based on your resume...
                        </p>

                        {error && (
                            <div className="project-error">
                                {error}
                            </div>
                        )}

                    </div>

                </div>

            </div>
        );
    }

    // ==========================================
    // MAIN PROJECT DEFENSE SCREEN
    // ==========================================

    return (
        <div className="project-page">

            <div className="project-container">

                {/* ======================================
            HEADER
        ====================================== */}

                <div className="project-header">

                    <div>

                        <p className="tagline">
                            STEP 05 — AI PROJECT DEFENSE
                        </p>

                        <h1>
                            Show us what you built.
                        </h1>

                        <p className="project-description">
                            Anvesh will challenge your understanding
                            of the projects listed on your resume.
                        </p>

                    </div>

                    <div className="project-progress">

                        <span>
                            QUESTION
                        </span>

                        <strong>
                            {questionNumber}

                            <small>
                                /{TOTAL_QUESTIONS}
                            </small>
                        </strong>

                    </div>

                </div>

                {/* ======================================
            PROGRESS BAR
        ====================================== */}

                <div className="project-progress-bar">

                    <div
                        style={{
                            width:
                                `${(questionNumber /
                                    TOTAL_QUESTIONS) *
                                100
                                }%`,
                        }}
                    />

                </div>

                {/* ======================================
            QUESTION CARD
        ====================================== */}

                <div className="project-question-card">

                    {/* PROJECT */}

                    <div className="project-name">

                        <span>
                            PROJECT
                        </span>

                        <strong>
                            {question.projectName}
                        </strong>

                    </div>

                    {/* TAGS */}

                    <div className="project-tags">

                        <span>
                            {question.category}
                        </span>

                        <span>
                            {question.difficulty}
                        </span>

                    </div>

                    {/* SKILL */}

                    <p className="project-skill">

                        Evaluating:{" "}

                        <strong>
                            {question.skillTested}
                        </strong>

                    </p>

                    {/* QUESTION */}

                    <h2>
                        {question.question}
                    </h2>

                    {/* ANSWER */}

                    <textarea
                        value={answer}
                        onChange={(event) =>
                            setAnswer(
                                event.target.value
                            )
                        }
                        placeholder="Explain what you built, why you built it this way, and what you personally worked on..."
                        rows={8}
                        disabled={evaluating}
                    />

                    {/* FOOTER */}

                    <div className="project-answer-footer">

                        <span>
                            Be specific. Anvesh is checking
                            whether you genuinely understand
                            your project.
                        </span>

                        <button
                            className="primary-button"
                            onClick={
                                evaluation
                                    ? nextQuestion
                                    : submitAnswer
                            }
                            disabled={evaluating}
                        >

                            {evaluating
                                ? "Anvesh is evaluating..."

                                : evaluation
                                    ? questionNumber ===
                                        TOTAL_QUESTIONS
                                        ? "Finish Defense →"
                                        : "Next Question →"

                                    : "Submit Answer →"}

                        </button>

                    </div>

                </div>

                {/* ======================================
            ERROR
        ====================================== */}

                {error && (
                    <div className="project-error">
                        {error}
                    </div>
                )}

                {/* ======================================
            AI EVALUATION
        ====================================== */}

                {evaluation && (

                    <div className="project-evaluation-card">

                        {/* HEADER */}

                        <div className="project-evaluation-header">

                            <div>

                                <p className="section-label">
                                    AI PROJECT EVALUATION
                                </p>

                                <h2>
                                    Here's what Anvesh thinks.
                                </h2>

                            </div>

                            <div className="project-evaluation-score">

                                {
                                    evaluation.totalScore
                                }

                                <span>
                                    /40
                                </span>

                            </div>

                        </div>

                        {/* FEEDBACK */}

                        <p className="project-feedback">
                            {evaluation.feedback}
                        </p>

                        {/* METRICS */}

                        <div className="project-metrics">

                            <div>

                                <span>
                                    Project Understanding
                                </span>

                                <strong>
                                    {
                                        evaluation
                                            .projectUnderstanding
                                    }
                                    /10
                                </strong>

                            </div>

                            <div>

                                <span>
                                    Technical Depth
                                </span>

                                <strong>
                                    {
                                        evaluation
                                            .technicalDepth
                                    }
                                    /10
                                </strong>

                            </div>

                            <div>

                                <span>
                                    Ownership
                                </span>

                                <strong>
                                    {
                                        evaluation
                                            .ownership
                                    }
                                    /10
                                </strong>

                            </div>

                            <div>

                                <span>
                                    Problem Solving
                                </span>

                                <strong>
                                    {
                                        evaluation
                                            .problemSolving
                                    }
                                    /10
                                </strong>

                            </div>

                        </div>

                        {/* OWNERSHIP */}

                        <div className="ownership-warning">

                            <span>
                                OWNERSHIP CHECK
                            </span>

                            <p>
                                {
                                    evaluation
                                        .ownershipConcern
                                }
                            </p>

                        </div>

                        {/* FEEDBACK COLUMNS */}

                        <div className="project-feedback-columns">

                            {/* STRENGTHS */}

                            <div>

                                <p className="section-label">
                                    WHAT YOU DID WELL
                                </p>

                                {evaluation.strengths?.map(
                                    (item, index) => (

                                        <div
                                            className="project-feedback-item"
                                            key={index}
                                        >
                                            ✓ {item}
                                        </div>

                                    )
                                )}

                            </div>

                            {/* IMPROVEMENTS */}

                            <div>

                                <p className="section-label">
                                    WHAT TO IMPROVE
                                </p>

                                {evaluation.improvements?.map(
                                    (item, index) => (

                                        <div
                                            className="project-feedback-item"
                                            key={index}
                                        >
                                            ! {item}
                                        </div>

                                    )
                                )}

                            </div>

                        </div>

                    </div>

                )}

            </div>

        </div>
    );
}

export default ProjectDefense;