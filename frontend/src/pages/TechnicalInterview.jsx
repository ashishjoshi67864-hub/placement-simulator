import { useEffect, useState } from "react";

const TOTAL_QUESTIONS = 5;

function TechnicalInterview({ onContinue }) {
    const [question, setQuestion] = useState(null);

    const [questionNumber, setQuestionNumber] =
        useState(1);

    const [answer, setAnswer] = useState("");

    const [loadingQuestion, setLoadingQuestion] =
        useState(true);

    const [evaluating, setEvaluating] =
        useState(false);

    const [evaluation, setEvaluation] =
        useState(null);

    const [results, setResults] = useState([]);

    const [finished, setFinished] =
        useState(false);

    const [error, setError] =
        useState("");

    const resumeText =
        sessionStorage.getItem(
            "resumeText"
        );

    const candidateProfile =
        JSON.parse(
            sessionStorage.getItem(
                "candidateProfile"
            ) || "{}"
        );

    // ==========================================
    // LOAD QUESTION
    // ==========================================

    async function loadQuestion(number) {
        setLoadingQuestion(true);
        setEvaluation(null);
        setAnswer("");
        setError("");

        try {
            const response = await fetch(
                "http://localhost:5000/api/interview/question",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        resumeText,
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

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Could not generate question."
                );
            }

            setQuestion(
                data.question
            );
        } catch (error) {
            console.error(
                "Question error:",
                error
            );

            setError(
                error.message ||
                "Could not generate question."
            );
        } finally {
            setLoadingQuestion(false);
        }
    }

    // ==========================================
    // FIRST QUESTION
    // ==========================================

    useEffect(() => {
        loadQuestion(1);
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

        setEvaluating(true);
        setError("");

        try {
            const response = await fetch(
                "http://localhost:5000/api/interview/evaluate",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        question:
                            question.question,

                        answer,

                        targetRole:
                            candidateProfile.role,

                        resumeText,
                    }),
                }
            );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Could not evaluate answer."
                );
            }

            const newResult = {
                question:
                    question.question,

                category:
                    question.category,

                difficulty:
                    question.difficulty,

                skillTested:
                    question.skillTested,

                answer,

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

            sessionStorage.setItem(
                "technicalResults",
                JSON.stringify(
                    updatedResults
                )
            );
        } catch (error) {
            console.error(
                "Evaluation error:",
                error
            );

            setError(
                error.message ||
                "Could not evaluate answer."
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
    // FINAL SCORE
    // ==========================================

    function getFinalScore() {
        if (!results.length) {
            return 0;
        }

        const total =
            results.reduce(
                (sum, item) =>
                    sum +
                    item.evaluation.totalScore,
                0
            );

        const maximum =
            results.length * 40;

        return Math.round(
            (total / maximum) * 100
        );
    }

    // ==========================================
    // PERFORMANCE
    // ==========================================

    function getPerformance(score) {
        if (score >= 85) {
            return {
                title:
                    "Excellent Technical Performance",

                description:
                    "You demonstrated strong technical understanding and problem-solving ability.",
            };
        }

        if (score >= 70) {
            return {
                title:
                    "Strong Technical Performance",

                description:
                    "You have a solid technical foundation with some areas to strengthen.",
            };
        }

        if (score >= 50) {
            return {
                title:
                    "Moderate Technical Performance",

                description:
                    "You understand several concepts but need more depth and consistency.",
            };
        }

        return {
            title:
                "Technical Gaps Detected",

            description:
                "Your answers reveal important technical areas that need more preparation.",
        };
    }

    // ==========================================
    // FINISHED
    // ==========================================

    if (finished) {
        const finalScore =
            getFinalScore();

        const performance =
            getPerformance(
                finalScore
            );

        return (
            <div className="technical-page">
                <div className="technical-container">

                    <div className="technical-result">

                        <p className="tagline">
                            STEP 04 — TECHNICAL RESULT
                        </p>

                        <h1>
                            Technical interview complete.
                        </h1>

                        <p className="technical-description">
                            Anvesh evaluated your technical
                            performance across the interview.
                        </p>

                        <div className="technical-score-circle">

                            <div className="technical-big-score">
                                {finalScore}
                                <span>/100</span>
                            </div>

                            <p>
                                Technical Score
                            </p>

                        </div>

                        <div className="performance-card">

                            <p className="section-label">
                                INTERVIEW ASSESSMENT
                            </p>

                            <h2>
                                {performance.title}
                            </h2>

                            <p>
                                {performance.description}
                            </p>

                        </div>

                        <div className="technical-breakdown">

                            {results.map(
                                (item, index) => (
                                    <div
                                        className="technical-question-result"
                                        key={index}
                                    >

                                        <div>
                                            <span>
                                                QUESTION{" "}
                                                {index + 1}
                                            </span>

                                            <h3>
                                                {item.question}
                                            </h3>
                                        </div>

                                        <strong>
                                            {
                                                item.evaluation
                                                    .totalScore
                                            }
                                            /40
                                        </strong>

                                    </div>
                                )
                            )}

                        </div>

                        <button
                            className="primary-button"
                            onClick={onContinue}
                        >
                            Continue to Project Defense →
                        </button>

                    </div>

                </div>
            </div>
        );
    }

    // ==========================================
    // LOADING
    // ==========================================

    if (
        loadingQuestion ||
        !question
    ) {
        return (
            <div className="technical-page">

                <div className="technical-container">

                    <div className="technical-loading">

                        <p className="tagline">
                            STEP 04 — AI TECHNICAL INTERVIEW
                        </p>

                        <div className="loading-orb">
                            AI
                        </div>

                        <h1>
                            Anvesh is preparing your question.
                        </h1>

                        <p>
                            Analyzing your resume and target role...
                        </p>

                    </div>

                </div>

            </div>
        );
    }

    // ==========================================
    // MAIN INTERVIEW
    // ==========================================

    return (
        <div className="technical-page">

            <div className="technical-container">

                <div className="technical-header">

                    <div>

                        <p className="tagline">
                            STEP 04 — AI TECHNICAL INTERVIEW
                        </p>

                        <h1>
                            Let's talk tech.
                        </h1>

                        <p className="technical-description">
                            Answer naturally. Anvesh will
                            evaluate your technical understanding.
                        </p>

                    </div>

                    <div className="interview-progress">

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

                <div className="technical-progress">

                    <div
                        style={{
                            width: `${(questionNumber /
                                    TOTAL_QUESTIONS) *
                                100
                                }%`,
                        }}
                    />

                </div>

                <div className="technical-question-card">

                    <div className="question-tags">

                        <span>
                            {question.category}
                        </span>

                        <span>
                            {question.difficulty}
                        </span>

                    </div>

                    <p className="skill-tested">
                        Evaluating:{" "}
                        <strong>
                            {question.skillTested}
                        </strong>
                    </p>

                    <h2>
                        {question.question}
                    </h2>

                    <textarea
                        value={answer}
                        onChange={(event) =>
                            setAnswer(
                                event.target.value
                            )
                        }
                        placeholder="Explain your answer here..."
                        rows={8}
                        disabled={evaluating}
                    />

                    <div className="answer-footer">

                        <span>
                            Answer naturally. You don't need
                            perfect English.
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
                                        ? "Finish Interview →"
                                        : "Next Question →"
                                    : "Submit Answer →"}
                        </button>

                    </div>

                </div>

                {error && (
                    <div className="technical-error">
                        {error}
                    </div>
                )}

                {evaluation && (

                    <div className="evaluation-card">

                        <div className="evaluation-header">

                            <div>

                                <p className="section-label">
                                    AI INTERVIEWER FEEDBACK
                                </p>

                                <h2>
                                    Here's what Anvesh thinks.
                                </h2>

                            </div>

                            <div className="evaluation-score">

                                {
                                    evaluation.totalScore
                                }

                                <span>
                                    /40
                                </span>

                            </div>

                        </div>

                        <p className="evaluation-feedback">
                            {evaluation.feedback}
                        </p>

                        <div className="evaluation-metrics">

                            <div>
                                <span>
                                    Understanding
                                </span>

                                <strong>
                                    {
                                        evaluation
                                            .technicalUnderstanding
                                    }
                                    /10
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Accuracy
                                </span>

                                <strong>
                                    {
                                        evaluation.accuracy
                                    }
                                    /10
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Depth
                                </span>

                                <strong>
                                    {
                                        evaluation.depth
                                    }
                                    /10
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Communication
                                </span>

                                <strong>
                                    {
                                        evaluation.communication
                                    }
                                    /10
                                </strong>
                            </div>

                        </div>

                        <div className="feedback-columns">

                            <div>

                                <p className="section-label">
                                    WHAT YOU DID WELL
                                </p>

                                {evaluation.strengths?.map(
                                    (item, index) => (
                                        <div
                                            className="feedback-item"
                                            key={index}
                                        >
                                            ✓ {item}
                                        </div>
                                    )
                                )}

                            </div>

                            <div>

                                <p className="section-label">
                                    WHAT TO IMPROVE
                                </p>

                                {evaluation.improvements?.map(
                                    (item, index) => (
                                        <div
                                            className="feedback-item"
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

export default TechnicalInterview;