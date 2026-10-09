import { useEffect, useState } from "react";

const questions = [
    {
        category: "Quantitative Aptitude",
        question:
            "A train travels 360 km in 4 hours. What is its average speed?",
        options: [
            "80 km/h",
            "90 km/h",
            "100 km/h",
            "120 km/h",
        ],
        answer: 1,
    },

    {
        category: "Quantitative Aptitude",
        question:
            "If a product costs ₹800 and is sold at a 15% profit, what is its selling price?",
        options: [
            "₹880",
            "₹900",
            "₹920",
            "₹940",
        ],
        answer: 2,
    },

    {
        category: "Logical Reasoning",
        question:
            "Find the next number: 2, 6, 12, 20, 30, ?",
        options: [
            "36",
            "40",
            "42",
            "44",
        ],
        answer: 2,
    },

    {
        category: "Logical Reasoning",
        question:
            "If all developers are problem solvers and some students are developers, which statement must be true?",
        options: [
            "All students are problem solvers",
            "Some students are problem solvers",
            "No student is a problem solver",
            "All problem solvers are developers",
        ],
        answer: 1,
    },

    {
        category: "Quantitative Aptitude",
        question:
            "A number is increased by 20% and then decreased by 20%. What is the overall percentage change?",
        options: [
            "No change",
            "2% decrease",
            "4% decrease",
            "4% increase",
        ],
        answer: 2,
    },

    {
        category: "Logical Reasoning",
        question:
            "Which number is different from the others?",
        options: [
            "16",
            "25",
            "36",
            "63",
        ],
        answer: 3,
    },

    {
        category: "Verbal Ability",
        question:
            "Choose the word closest in meaning to 'DILIGENT'.",
        options: [
            "Lazy",
            "Careless",
            "Hardworking",
            "Confused",
        ],
        answer: 2,
    },

    {
        category: "Verbal Ability",
        question:
            "Choose the grammatically correct sentence.",
        options: [
            "He don't like programming.",
            "He doesn't likes programming.",
            "He doesn't like programming.",
            "He not like programming.",
        ],
        answer: 2,
    },

    {
        category: "Logical Reasoning",
        question:
            "If CODE is written as DPEF, how would JAVA be written?",
        options: [
            "KBWB",
            "KZWB",
            "KBVA",
            "JAWB",
        ],
        answer: 0,
    },

    {
        category: "Quantitative Aptitude",
        question:
            "A student scores 72, 68, 80 and 76 in four tests. What score is needed in the fifth test to achieve an average of 75?",
        options: [
            "74",
            "76",
            "78",
            "80",
        ],
        answer: 1,
    },
];

const TOTAL_TIME = 10 * 60;

function Aptitude({ onContinue }) {
    const [currentQuestion, setCurrentQuestion] =
        useState(0);

    const [selectedAnswers, setSelectedAnswers] =
        useState(Array(questions.length).fill(null));

    const [timeLeft, setTimeLeft] =
        useState(TOTAL_TIME);

    const [finished, setFinished] =
        useState(false);

    const [score, setScore] =
        useState(0);

    // ==========================================
    // TIMER
    // ==========================================

    useEffect(() => {
        if (finished) {
            return;
        }

        if (timeLeft <= 0) {
            finishTest();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((previous) =>
                previous - 1
            );
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, finished]);

    // ==========================================
    // FORMAT TIME
    // ==========================================

    function formatTime(seconds) {
        const minutes = Math.floor(
            seconds / 60
        );

        const remainingSeconds =
            seconds % 60;

        return `${String(minutes).padStart(
            2,
            "0"
        )}:${String(
            remainingSeconds
        ).padStart(2, "0")}`;
    }

    // ==========================================
    // SELECT ANSWER
    // ==========================================

    function selectAnswer(answerIndex) {
        const updatedAnswers = [
            ...selectedAnswers,
        ];

        updatedAnswers[currentQuestion] =
            answerIndex;

        setSelectedAnswers(
            updatedAnswers
        );
    }

    // ==========================================
    // NEXT QUESTION
    // ==========================================

    function nextQuestion() {
        if (
            currentQuestion <
            questions.length - 1
        ) {
            setCurrentQuestion(
                currentQuestion + 1
            );
        }
    }

    // ==========================================
    // PREVIOUS QUESTION
    // ==========================================

    function previousQuestion() {
        if (currentQuestion > 0) {
            setCurrentQuestion(
                currentQuestion - 1
            );
        }
    }

    // ==========================================
    // FINISH TEST
    // ==========================================

    function finishTest() {
        let calculatedScore = 0;

        selectedAnswers.forEach(
            (answer, index) => {
                if (
                    answer ===
                    questions[index].answer
                ) {
                    calculatedScore++;
                }
            }
        );

        setScore(calculatedScore);

        sessionStorage.setItem(
            "aptitudeResult",
            JSON.stringify({
                score: calculatedScore,
                total: questions.length,
                percentage: Math.round(
                    (calculatedScore /
                        questions.length) *
                    100
                ),
                answers: selectedAnswers,
            })
        );

        setFinished(true);
    }

    // ==========================================
    // SCORE MESSAGE
    // ==========================================

    function getPerformance() {
        const percentage =
            (score / questions.length) *
            100;

        if (percentage >= 80) {
            return {
                title: "Strong Performance",
                description:
                    "You demonstrated strong aptitude fundamentals.",
            };
        }

        if (percentage >= 60) {
            return {
                title: "Good Performance",
                description:
                    "You have a solid foundation, but there is room to improve.",
            };
        }

        if (percentage >= 40) {
            return {
                title: "Needs Improvement",
                description:
                    "Your fundamentals need more practice before the next round.",
            };
        }

        return {
            title: "Weak Performance",
            description:
                "The aptitude round exposed significant gaps in your fundamentals.",
        };
    }

    // ==========================================
    // RESULT SCREEN
    // ==========================================

    if (finished) {
        const performance =
            getPerformance();

        return (
            <div className="aptitude-page">

                <div className="aptitude-container result-container">

                    <p className="tagline">
                        STEP 03 — APTITUDE RESULT
                    </p>

                    <h1>
                        Here's how you performed.
                    </h1>

                    <p className="aptitude-description">
                        Your aptitude performance has been
                        added to your placement simulation.
                    </p>

                    {/* SCORE */}

                    <div className="aptitude-result-score">

                        <div className="big-score">
                            {score}
                            <span>
                                /{questions.length}
                            </span>
                        </div>

                        <p>
                            {Math.round(
                                (score /
                                    questions.length) *
                                100
                            )}
                            % accuracy
                        </p>

                    </div>

                    {/* PERFORMANCE */}

                    <div className="performance-card">

                        <p className="section-label">
                            PLACEMENT IMPACT
                        </p>

                        <h2>
                            {performance.title}
                        </h2>

                        <p>
                            {performance.description}
                        </p>

                    </div>

                    {/* BREAKDOWN */}

                    <div className="aptitude-breakdown">

                        <div className="breakdown-card">
                            <span>
                                Quantitative
                            </span>

                            <strong>
                                {
                                    questions.filter(
                                        (q) =>
                                            q.category ===
                                            "Quantitative Aptitude"
                                    ).filter(
                                        (q, index) => {
                                            const originalIndex =
                                                questions.indexOf(q);

                                            return (
                                                selectedAnswers[
                                                originalIndex
                                                ] === q.answer
                                            );
                                        }
                                    ).length
                                }
                            </strong>
                        </div>

                        <div className="breakdown-card">
                            <span>
                                Logical
                            </span>

                            <strong>
                                {
                                    questions.filter(
                                        (q) =>
                                            q.category ===
                                            "Logical Reasoning"
                                    ).filter(
                                        (q) => {
                                            const originalIndex =
                                                questions.indexOf(q);

                                            return (
                                                selectedAnswers[
                                                originalIndex
                                                ] === q.answer
                                            );
                                        }
                                    ).length
                                }
                            </strong>
                        </div>

                        <div className="breakdown-card">
                            <span>
                                Verbal
                            </span>

                            <strong>
                                {
                                    questions.filter(
                                        (q) =>
                                            q.category ===
                                            "Verbal Ability"
                                    ).filter(
                                        (q) => {
                                            const originalIndex =
                                                questions.indexOf(q);

                                            return (
                                                selectedAnswers[
                                                originalIndex
                                                ] === q.answer
                                            );
                                        }
                                    ).length
                                }
                            </strong>
                        </div>

                    </div>

                    {/* CONTINUE */}

                    <button
                        className="primary-button aptitude-result-button"
                        onClick={onContinue}
                    >
                        Continue to Technical Interview →
                    </button>

                </div>

            </div>
        );
    }

    // ==========================================
    // CURRENT QUESTION
    // ==========================================

    const question =
        questions[currentQuestion];

    const selectedAnswer =
        selectedAnswers[currentQuestion];

    const progress =
        ((currentQuestion + 1) /
            questions.length) *
        100;

    return (
        <div className="aptitude-page">

            <div className="aptitude-container">

                {/* HEADER */}

                <div className="aptitude-header">

                    <div>
                        <p className="tagline">
                            STEP 03 — APTITUDE ASSESSMENT
                        </p>

                        <h1>
                            Think like a recruiter.
                        </h1>
                    </div>

                    <div className="timer">
                        <span>
                            TIME REMAINING
                        </span>

                        <strong>
                            {formatTime(timeLeft)}
                        </strong>
                    </div>

                </div>

                {/* PROGRESS */}

                <div className="question-meta">

                    <span>
                        QUESTION{" "}
                        {currentQuestion + 1}
                        {" / "}
                        {questions.length}
                    </span>

                    <span>
                        {question.category}
                    </span>

                </div>

                <div className="progress-bar">

                    <div
                        className="progress-fill"
                        style={{
                            width: `${progress}%`,
                        }}
                    />

                </div>

                {/* QUESTION CARD */}

                <div className="question-card">

                    <h2>
                        {question.question}
                    </h2>

                    <div className="options">

                        {question.options.map(
                            (option, index) => {

                                const isSelected =
                                    selectedAnswer ===
                                    index;

                                return (
                                    <button
                                        key={index}
                                        className={`option ${isSelected
                                                ? "selected"
                                                : ""
                                            }`}
                                        onClick={() =>
                                            selectAnswer(index)
                                        }
                                    >

                                        <span className="option-letter">
                                            {String.fromCharCode(
                                                65 + index
                                            )}
                                        </span>

                                        <span>
                                            {option}
                                        </span>

                                    </button>
                                );
                            }
                        )}

                    </div>

                </div>

                {/* NAVIGATION */}

                <div className="question-navigation">

                    <button
                        className="secondary-button"
                        onClick={
                            previousQuestion
                        }
                        disabled={
                            currentQuestion === 0
                        }
                    >
                        ← Previous
                    </button>

                    {currentQuestion ===
                        questions.length - 1 ? (

                        <button
                            className="primary-button"
                            onClick={finishTest}
                        >
                            Submit Assessment →
                        </button>

                    ) : (

                        <button
                            className="primary-button"
                            onClick={nextQuestion}
                        >
                            Next Question →
                        </button>

                    )}

                </div>

                {/* QUESTION DOTS */}

                <div className="question-dots">

                    {questions.map(
                        (_, index) => (

                            <button
                                key={index}
                                className={`question-dot ${selectedAnswers[
                                        index
                                    ] !== null
                                        ? "answered"
                                        : ""
                                    } ${currentQuestion ===
                                        index
                                        ? "active"
                                        : ""
                                    }`}
                                onClick={() =>
                                    setCurrentQuestion(
                                        index
                                    )
                                }
                            >
                                {index + 1}
                            </button>

                        )
                    )}

                </div>

            </div>

        </div>
    );
}

export default Aptitude;