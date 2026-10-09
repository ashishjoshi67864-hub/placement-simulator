import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   SPEECH RECOGNITION DETECTION
   Runs once at module load — safe to read anywhere.
============================================================ */
const SpeechRecognition =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;
const speechSupported = Boolean(SpeechRecognition);

/* ============================================================
   CONSTANTS
============================================================ */

const TOTAL_QUESTIONS = 5;
const API_BASE = "http://localhost:5000/api/hr";

/* ============================================================
   HELPERS
============================================================ */

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
}

function scoreColor(n) {
  if (n >= 75) return "#a855f7";
  if (n >= 50) return "#f59e0b";
  return "#ef4444";
}

/* ============================================================
   SCORE RING
============================================================ */

function ScoreRing({ score, size = 120, stroke = 10, label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100);
  const dash = (pct / 100) * circ;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div style={{ marginTop: -size / 2 - 12, position: "relative", top: -size / 2 + 16, textAlign: "center", pointerEvents: "none" }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 700, color: scoreColor(score) }}>{score}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ============================================================
   MINI SCORE BAR
============================================================ */

function ScoreBar({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(value) }}>{value}/100</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${value}%`,
          background: `linear-gradient(90deg, ${scoreColor(value)}, #c084fc)`,
          borderRadius: 999,
          transition: "width 1s ease",
        }} />
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function HRInterview({ onContinue }) {

  /* ── session data ── */
  const candidateProfile = (() => {
    try { return JSON.parse(sessionStorage.getItem("candidateProfile") || "{}"); }
    catch { return {}; }
  })();
  const resumeText = sessionStorage.getItem("resumeText") || "";
  const resumeAnalysis = (() => {
    try { return JSON.parse(sessionStorage.getItem("resumeAnalysis") || "{}"); }
    catch { return {}; }
  })();

  /* ── state ── */
  const [phase, setPhase] = useState("interview"); // "interview" | "result"
  const [questionNum, setQuestionNum] = useState(1);

  const [currentQ, setCurrentQ] = useState(null);   // { question, focus }
  const [loadingQ, setLoadingQ] = useState(true);
  const [qError, setQError] = useState(null);

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState(null);   // per-question eval

  const [history, setHistory] = useState([]);     // all completed Q+A+eval
  const [prevQuestions, setPrevQuestions] = useState([]);

  /* ── voice state ── */
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false); // true while rec finishes after stop()
  const [voiceError, setVoiceError] = useState(null);
  const interimRef = useRef("");     // accumulates finalized partial transcripts
  const baseTextRef = useRef("");    // text present before this mic session started
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false); // ref mirror of isListening — safe inside closures

  const textareaRef = useRef(null);

  /* ── fetch first question on mount ── */
  useEffect(() => {
    fetchQuestion(1, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── auto-focus textarea when question arrives ── */
  useEffect(() => {
    if (currentQ && !loadingQ && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentQ, loadingQ]);

  /* ── cleanup on unmount ── */
  useEffect(() => {
    return () => {
      stopVoiceAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================
     API CALLS
  ============================================================ */

  /* ============================================================
     VOICE HELPERS
  ============================================================ */

  function stopVoiceAll() {
    // stop TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    // stop STT — signal intent to stop via ref BEFORE calling .stop()
    // so that onend knows not to restart, but still processes its final results.
    listeningRef.current = false;
    setIsListening(false);
    setIsFinalizing(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* */ }
      recognitionRef.current = null;
    }
    // Only clear the accumulator after we've fully stopped.
    // onend/onresult can no longer fire because recognitionRef is null.
    interimRef.current = "";
    baseTextRef.current = "";
  }

  function playQuestion(text) {
    if (!window.speechSynthesis || !text) return;
    // cancel anything already speaking
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    // prefer a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      v => v.lang.startsWith("en") && !v.name.toLowerCase().includes("google")
    ) || voices.find(v => v.lang.startsWith("en")) || null;
    if (preferred) utter.voice = preferred;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  function stopQuestion() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function startListening() {
    if (!speechSupported) return;
    setVoiceError(null);
    setIsFinalizing(false);

    // stop any ongoing STT first
    if (recognitionRef.current) {
      listeningRef.current = false;
      try { recognitionRef.current.stop(); } catch (_) { /* */ }
      recognitionRef.current = null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    // Snapshot the text that exists BEFORE this mic session starts.
    // Stored in a ref so the onresult closure always reads the right value.
    baseTextRef.current = answer.trim();
    interimRef.current = "";

    rec.onresult = (event) => {
      let interim = "";
      let newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += t + " ";
        } else {
          interim += t;
        }
      }
      if (newFinal) {
        interimRef.current += newFinal;
      }
      // Build display answer: base + all finalized speech + current interim
      const full =
        (baseTextRef.current ? baseTextRef.current + " " : "") +
        interimRef.current +
        interim;
      setAnswer(full.replace(/\s+/g, " ").trimStart());
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setVoiceError("Microphone access was denied. You can continue by typing your answer.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setVoiceError(`Voice error: ${event.error}. You can still type your answer.`);
      }
      listeningRef.current = false;
      setIsListening(false);
      setIsFinalizing(false);
      interimRef.current = "";
      if (recognitionRef.current === rec) recognitionRef.current = null;
    };

    rec.onend = () => {
      // Use listeningRef (not isListening state) — avoids stale closure bug.
      if (listeningRef.current && recognitionRef.current === rec) {
        // User hasn't asked to stop — recognition ended on its own (e.g. silence timeout).
        // Restart it to keep continuous mode alive.
        try {
          rec.start();
        } catch (_) {
          listeningRef.current = false;
          setIsListening(false);
          setIsFinalizing(false);
          if (recognitionRef.current === rec) recognitionRef.current = null;
        }
      } else {
        // User clicked Stop (or stopVoiceAll ran).
        // By the time onend fires, all final onresult events have already been
        // dispatched — interimRef.current now holds the complete transcript.
        // Commit it cleanly to `answer`, then release state.
        setAnswer(prev => {
          // Rebuild from base + full finalized transcript to drop any dangling interim.
          const committed =
            (baseTextRef.current ? baseTextRef.current + " " : "") +
            interimRef.current;
          // If the user has manually edited the textarea since the last onresult,
          // prefer the longer / more-complete string.
          return committed.trim().length >= prev.trim().length
            ? committed.replace(/\s+/g, " ").trim()
            : prev.trim();
        });
        interimRef.current = "";
        baseTextRef.current = "";
        setIsFinalizing(false);
        if (recognitionRef.current === rec) recognitionRef.current = null;
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      listeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      setVoiceError("Could not start voice recognition. Please type your answer.");
    }
  }

  function stopListening() {
    // Signal to onend that we intentionally stopped — do this BEFORE calling .stop()
    // so the onend handler sees listeningRef.current === false and commits the transcript.
    listeningRef.current = false;
    setIsListening(false);
    setIsFinalizing(true); // waiting for onend to fire and finalize the answer
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* */ }
      // Do NOT set recognitionRef.current = null here yet — onend needs to match it.
      // Do NOT clear interimRef here — the final onresult may still be in-flight.
    }
    // interimRef.current is cleared by onend after it commits the final answer.
  }

  /* ============================================================
     API CALLS
  ============================================================ */

  async function fetchQuestion(num, prevQs) {
    // clean up any running voice before next question
    stopVoiceAll();
    setLoadingQ(true);
    setQError(null);
    setCurrentQ(null);
    setEvaluation(null);
    setAnswer("");

    try {
      const res = await fetch(`${API_BASE}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          candidateProfile,
          questionNumber: num,
          previousQuestions: prevQs,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setCurrentQ(data);

    } catch (err) {
      setQError("Could not load question. Please check your backend connection.");
      console.error("HR question fetch error:", err);
    } finally {
      setLoadingQ(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQ.question,
          answer: answer.trim(),
          candidateProfile,
          targetRole: candidateProfile?.role || "Software Developer",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setEvaluation(data);

    } catch (err) {
      setEvaluation({
        communication: 60,
        relevance: 60,
        depth: 55,
        confidence: 60,
        feedback: "Could not connect to AI evaluator. Scores are estimated.",
        strengths: ["Answer submitted"],
        improvements: ["Ensure backend is running for AI evaluation"],
        error: true,
      });
      console.error("HR evaluate error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function goNextQuestion() {
    // stop any running voice before moving on
    stopVoiceAll();

    const newHistory = [
      ...history,
      {
        questionNum,
        question: currentQ.question,
        focus: currentQ.focus || [],
        answer,
        evaluation,
      },
    ];

    const newPrevQs = [...prevQuestions, currentQ.question];

    setHistory(newHistory);
    setPrevQuestions(newPrevQs);

    if (questionNum >= TOTAL_QUESTIONS) {
      buildResult(newHistory);
    } else {
      const next = questionNum + 1;
      setQuestionNum(next);
      fetchQuestion(next, newPrevQs);
    }
  }

  function buildResult(hist) {
    const comms = hist.map(h => h.evaluation?.communication ?? 0);
    const relevs = hist.map(h => h.evaluation?.relevance ?? 0);
    const depths = hist.map(h => h.evaluation?.depth ?? 0);
    const confs = hist.map(h => h.evaluation?.confidence ?? 0);

    const avgComm = avg(comms);
    const avgRelev = avg(relevs);
    const avgDepth = avg(depths);
    const avgConf = avg(confs);

    // behavioural = average of all four
    const behavioral = avg([avgComm, avgRelev, avgDepth, avgConf]);

    const overallScore = avg([avgComm, avgRelev, avgDepth, avgConf, behavioral]);

    const allStrengths = [...new Set(hist.flatMap(h => h.evaluation?.strengths || []))].slice(0, 4);
    const allImprovements = [...new Set(hist.flatMap(h => h.evaluation?.improvements || []))].slice(0, 4);

    const hrResult = {
      overallScore,
      communication: avgComm,
      relevance: avgRelev,
      depth: avgDepth,
      confidence: avgConf,
      behavioralThinking: behavioral,
      strengths: allStrengths,
      areasToImprove: allImprovements,
      questionHistory: hist,
      demoMode: hist.some(h => h.evaluation?.demoMode),
    };

    sessionStorage.setItem("hrResult", JSON.stringify(hrResult));
    setPhase("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============================================================
     RESULT SCREEN
  ============================================================ */

  if (phase === "result") {
    let hrResult = {};
    try { hrResult = JSON.parse(sessionStorage.getItem("hrResult") || "{}"); }
    catch { /* */ }

    const {
      overallScore = 0,
      communication = 0,
      relevance = 0,
      depth = 0,
      confidence = 0,
      behavioralThinking = 0,
      strengths = [],
      areasToImprove = [],
    } = hrResult;

    return (
      <div className="hr-page">
        <div className="hr-container">

          {/* Header */}
          <div className="hr-header">
            <p className="hr-step-label">STEP 07 — HR INTERVIEW RESULT</p>
            <h1 className="hr-title">HR Interview Complete</h1>
            <p className="hr-subtitle">Here's how you performed across all 5 questions.</p>
          </div>

          {/* Overall Score Ring */}
          <div className="hr-result-score-wrap">
            <div style={{ transform: "scale(1.2)", marginBottom: 24 }}>
              <ScoreRing score={overallScore} size={140} stroke={12} label="HR SCORE" />
            </div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
              {overallScore >= 75 ? "Excellent HR Performance 🌟" :
                overallScore >= 55 ? "Good Showing, Keep Polishing 👍" :
                  "Needs More Practice 💪"}
            </div>
          </div>

          {/* Category Bars */}
          <div className="hr-card" style={{ marginTop: 32 }}>
            <h3 className="hr-section-title">Evaluation Breakdown</h3>
            <ScoreBar label="Communication" value={communication} />
            <ScoreBar label="Relevance" value={relevance} />
            <ScoreBar label="Depth" value={depth} />
            <ScoreBar label="Confidence" value={confidence} />
            <ScoreBar label="Behavioral Thinking" value={behavioralThinking} />
          </div>

          {/* Strengths + Areas */}
          <div className="hr-two-col">

            {strengths.length > 0 && (
              <div className="hr-card hr-strengths">
                <h3 className="hr-section-title">✦ Strengths</h3>
                <ul className="hr-list">
                  {strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {areasToImprove.length > 0 && (
              <div className="hr-card hr-improve">
                <h3 className="hr-section-title">◈ Areas to Improve</h3>
                <ul className="hr-list">
                  {areasToImprove.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>

          {/* Continue */}
          <div style={{ textAlign: "center", marginTop: 48, paddingBottom: 120 }}>
            <button
              type="button"
              className="hr-primary-btn"
              onClick={onContinue}
            >
              Continue to Final Decision →
            </button>
          </div>

        </div>
      </div>
    );
  }

  /* ============================================================
     INTERVIEW SCREEN
  ============================================================ */

  const progress = ((questionNum - 1) / TOTAL_QUESTIONS) * 100;

  return (
    <div className="hr-page">
      <div className="hr-container">

        {/* Header */}
        <div className="hr-header">
          <p className="hr-step-label">STEP 07 — HR INTERVIEW</p>
          <h1 className="hr-title">HR Interview</h1>
          <p className="hr-subtitle">Let's see how you handle the human side.</p>
        </div>

        {/* Progress Bar */}
        <div className="hr-progress-wrap">
          <div className="hr-progress-info">
            <span>Question {questionNum} / {TOTAL_QUESTIONS}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="hr-progress-track">
            <div
              className="hr-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="hr-card hr-question-card">

          {/* Loading question */}
          {loadingQ && (
            <div className="hr-loading">
              <div className="hr-spinner" />
              <p>Generating your HR question…</p>
            </div>
          )}

          {/* Error */}
          {qError && !loadingQ && (
            <div className="hr-error-box">
              <p>{qError}</p>
              <button
                type="button"
                className="hr-secondary-btn"
                onClick={() => fetchQuestion(questionNum, prevQuestions)}
              >
                Retry
              </button>
            </div>
          )}

          {/* Question */}
          {currentQ && !loadingQ && (
            <>
              {/* Focus tags */}
              {(currentQ.focus || []).length > 0 && (
                <div className="hr-focus-tags">
                  {currentQ.focus.map((f, i) => (
                    <span key={i} className="hr-tag">{f}</span>
                  ))}
                </div>
              )}

              {/* AI Recruiter label */}
              <p className="hr-recruiter-label">🤖 AI RECRUITER</p>

              <p className="hr-question-text">{currentQ.question}</p>

              {/* Play question button */}
              <div className="hr-voice-play-row">
                <button
                  type="button"
                  className={`hr-voice-btn hr-voice-play-btn ${isSpeaking ? "hr-voice-btn--active" : ""}`}
                  onClick={isSpeaking ? stopQuestion : () => playQuestion(currentQ.question)}
                >
                  {isSpeaking ? (
                    <><span className="hr-voice-icon">⏹</span> Stop Question</>
                  ) : (
                    <><span className="hr-voice-icon">🔊</span> Play Question</>
                  )}
                </button>
              </div>

              {/* Answer area — hidden once evaluated */}
              {!evaluation && (
                <>
                  {/* Divider */}
                  <div className="hr-answer-divider">
                    <span>YOUR ANSWER</span>
                  </div>

                  {/* Voice not supported notice */}
                  {!speechSupported && (
                    <div className="hr-voice-notice">
                      Voice input isn't supported in this browser. You can type your answer instead.
                    </div>
                  )}

                  {/* Voice error */}
                  {voiceError && (
                    <div className="hr-voice-error">{voiceError}</div>
                  )}

                  {/* Voice controls row */}
                  {speechSupported && (
                    <div className="hr-mic-row">
                      <button
                        type="button"
                        className={`hr-voice-btn hr-mic-btn ${isListening ? "hr-mic-btn--recording" : isFinalizing ? "hr-mic-btn--finalizing" : ""}`}
                        onClick={isListening ? stopListening : isFinalizing ? undefined : startListening}
                        disabled={submitting || isFinalizing}
                        title={isListening ? "Click to stop recording" : "Click to start voice input"}
                      >
                        {isListening ? (
                          <><span className="hr-pulse-dot" />🔴 Listening… Click to Stop</>
                        ) : isFinalizing ? (
                          <><span className="hr-spinner hr-spinner-sm" /> Finalizing…</>
                        ) : (
                          <><span className="hr-voice-icon">🎙</span> Start Answer</>
                        )}
                      </button>
                      {!isListening && !isFinalizing && (
                        <span className="hr-mic-hint">Speak naturally. Your answer will appear below.</span>
                      )}
                      {isFinalizing && (
                        <span className="hr-mic-hint" style={{ color: "rgba(168,85,247,0.7)" }}>Processing final words…</span>
                      )}
                    </div>
                  )}

                  {/* Shared textarea — voice transcript + manual typing */}
                  <textarea
                    ref={textareaRef}
                    className={`hr-textarea ${isListening ? "hr-textarea--listening" : ""
                      }`}
                    placeholder={
                      speechSupported
                        ? "Your spoken answer will appear here. You can also type or edit directly."
                        : "Type your answer here…"
                    }
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    disabled={submitting}
                    rows={6}
                  />

                  <div className="hr-btn-row">
                    <span className="hr-char-count">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
                    <button
                      type="button"
                      className="hr-primary-btn"
                      onClick={submitAnswer}
                      disabled={submitting || isFinalizing || !answer.trim()}
                    >
                      {submitting ? (
                        <span className="hr-btn-loading">
                          <span className="hr-spinner hr-spinner-sm" />
                          Evaluating your answer…
                        </span>
                      ) : isFinalizing ? (
                        <span className="hr-btn-loading">
                          <span className="hr-spinner hr-spinner-sm" />
                          Finalizing transcript…
                        </span>
                      ) : "Submit Answer →"}
                    </button>
                  </div>
                </>
              )}

              {/* Evaluation feedback */}
              {evaluation && (
                <div className="hr-eval-wrap">

                  {/* Score chips */}
                  <div className="hr-eval-scores">
                    {[
                      { label: "Communication", val: evaluation.communication },
                      { label: "Relevance", val: evaluation.relevance },
                      { label: "Depth", val: evaluation.depth },
                      { label: "Confidence", val: evaluation.confidence },
                    ].map(({ label, val }) => (
                      <div key={label} className="hr-score-chip">
                        <span className="hr-score-chip-val" style={{ color: scoreColor(val) }}>{val}</span>
                        <span className="hr-score-chip-label">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Feedback */}
                  <div className="hr-feedback-box">
                    <p className="hr-feedback-heading">💬 Feedback</p>
                    <p className="hr-feedback-text">{evaluation.feedback}</p>
                  </div>

                  {/* Strengths / Improvements inline */}
                  <div className="hr-two-col" style={{ marginTop: 16 }}>
                    {(evaluation.strengths || []).length > 0 && (
                      <div>
                        <p className="hr-mini-heading">✦ Strengths</p>
                        <ul className="hr-list hr-list-sm">
                          {evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {(evaluation.improvements || []).length > 0 && (
                      <div>
                        <p className="hr-mini-heading">◈ To Improve</p>
                        <ul className="hr-list hr-list-sm">
                          {evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Next / Finish button */}
                  <div style={{ textAlign: "right", marginTop: 24 }}>
                    <button
                      type="button"
                      className="hr-primary-btn"
                      onClick={goNextQuestion}
                    >
                      {questionNum >= TOTAL_QUESTIONS
                        ? "See HR Result →"
                        : `Next Question →`}
                    </button>
                  </div>

                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom padding for nav bar */}
        <div style={{ height: 100 }} />

      </div>

      <style>{`
        /* ── Page shell ── */
        .hr-page {
          min-height: 100vh;
          background: #0a0a0f;
          color: #fff;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          padding: 0 16px;
        }
        .hr-container {
          max-width: 760px;
          margin: 0 auto;
          padding: 48px 0 0;
        }

        /* ── Header ── */
        .hr-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .hr-step-label {
          font-size: 11px;
          letter-spacing: 3px;
          color: #a855f7;
          text-transform: uppercase;
          margin: 0 0 12px;
        }
        .hr-title {
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 800;
          margin: 0 0 10px;
          background: linear-gradient(135deg, #fff 0%, #a855f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hr-subtitle {
          font-size: 15px;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }

        /* ── Progress bar ── */
        .hr-progress-wrap {
          margin-bottom: 28px;
        }
        .hr-progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 8px;
        }
        .hr-progress-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .hr-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #7c3aed, #a855f7);
          border-radius: 999px;
          transition: width 0.4s ease;
        }

        /* ── Card ── */
        .hr-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 28px 28px 24px;
          backdrop-filter: blur(12px);
          margin-bottom: 20px;
        }
        .hr-question-card {
          min-height: 200px;
        }

        /* ── Focus tags ── */
        .hr-focus-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 18px;
        }
        .hr-tag {
          background: rgba(168,85,247,0.15);
          border: 1px solid rgba(168,85,247,0.3);
          color: #c084fc;
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
        }

        /* ── Question text ── */
        .hr-question-text {
          font-size: 18px;
          font-weight: 600;
          line-height: 1.55;
          color: #fff;
          margin: 0 0 22px;
        }

        /* ── Textarea ── */
        .hr-textarea {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-family: inherit;
          padding: 14px 16px;
          resize: vertical;
          outline: none;
          transition: border-color 0.2s;
        }
        .hr-textarea:focus {
          border-color: #a855f7;
        }
        .hr-textarea::placeholder {
          color: rgba(255,255,255,0.3);
        }
        .hr-textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Button row ── */
        .hr-btn-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 14px;
          gap: 12px;
        }
        .hr-char-count {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
        }

        /* ── Buttons ── */
        .hr-primary-btn {
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 13px 28px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          white-space: nowrap;
        }
        .hr-primary-btn:hover:not(:disabled) {
          opacity: 0.88;
          transform: translateY(-1px);
        }
        .hr-primary-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .hr-secondary-btn {
          background: rgba(255,255,255,0.08);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .hr-secondary-btn:hover {
          background: rgba(255,255,255,0.12);
        }
        .hr-btn-loading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* ── Evaluation section ── */
        .hr-eval-wrap {
          margin-top: 8px;
          animation: fadeUp 0.35s ease;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hr-eval-scores {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 540px) {
          .hr-eval-scores { grid-template-columns: repeat(2, 1fr); }
        }
        .hr-score-chip {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 14px 10px 10px;
          text-align: center;
        }
        .hr-score-chip-val {
          font-size: 26px;
          font-weight: 800;
          display: block;
        }
        .hr-score-chip-label {
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin-top: 4px;
          display: block;
        }

        /* ── Feedback box ── */
        .hr-feedback-box {
          background: rgba(168,85,247,0.07);
          border: 1px solid rgba(168,85,247,0.2);
          border-radius: 12px;
          padding: 16px 18px;
        }
        .hr-feedback-heading {
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #a855f7;
          margin: 0 0 8px;
        }
        .hr-feedback-text {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255,255,255,0.75);
          margin: 0;
        }

        /* ── Two-col layout ── */
        .hr-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 580px) {
          .hr-two-col { grid-template-columns: 1fr; }
        }

        /* ── Lists ── */
        .hr-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .hr-list li {
          padding: 8px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 14px;
          color: rgba(255,255,255,0.75);
          line-height: 1.5;
        }
        .hr-list li:last-child { border-bottom: none; }
        .hr-list-sm li { font-size: 13px; padding: 6px 0; }

        /* ── Section headings ── */
        .hr-section-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          margin: 0 0 18px;
        }
        .hr-mini-heading {
          font-size: 11px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          margin: 0 0 8px;
        }

        /* ── Strengths / Improve card tint ── */
        .hr-strengths {
          border-color: rgba(168,85,247,0.2);
        }
        .hr-improve {
          border-color: rgba(245,158,11,0.2);
        }

        /* ── Result score wrap ── */
        .hr-result-score-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 0 8px;
        }

        /* ── Loading & error ── */
        .hr-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 40px 0;
          color: rgba(255,255,255,0.5);
          font-size: 14px;
        }
        .hr-error-box {
          text-align: center;
          padding: 32px;
          color: #f87171;
          font-size: 14px;
        }
        .hr-error-box button {
          margin-top: 12px;
        }

        /* ── Spinner ── */
        .hr-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(168,85,247,0.25);
          border-top-color: #a855f7;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .hr-spinner-sm {
          width: 16px;
          height: 16px;
          border-width: 2px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── AI Recruiter label ── */
        .hr-recruiter-label {
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          margin: 0 0 10px;
        }

        /* ── Voice play row ── */
        .hr-voice-play-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        /* ── Answer divider ── */
        .hr-answer-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 4px 0 18px;
          color: rgba(255,255,255,0.3);
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .hr-answer-divider::before,
        .hr-answer-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }

        /* ── Voice buttons ── */
        .hr-voice-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.8);
          border-radius: 10px;
          padding: 9px 16px;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          white-space: nowrap;
        }
        .hr-voice-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
        }
        .hr-voice-btn--active {
          border-color: rgba(168,85,247,0.5);
          background: rgba(168,85,247,0.12);
          color: #c084fc;
        }
        .hr-voice-icon {
          font-size: 15px;
        }

        /* ── Mic row ── */
        .hr-mic-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .hr-mic-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
        }
        .hr-mic-btn--recording {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.1);
          color: #f87171;
        }
        .hr-mic-btn--recording:hover {
          background: rgba(239,68,68,0.15) !important;
        }
        .hr-mic-btn--finalizing {
          border-color: rgba(168,85,247,0.4);
          background: rgba(168,85,247,0.08);
          color: rgba(168,85,247,0.8);
          cursor: not-allowed;
        }

        /* ── Pulse dot for recording indicator ── */
        .hr-pulse-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse-dot 1.2s ease infinite;
          margin-right: 2px;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }

        /* ── Textarea listening state ── */
        .hr-textarea--listening {
          border-color: rgba(239,68,68,0.4);
        }

        /* ── Voice notices ── */
        .hr-voice-notice {
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px;
          color: rgba(245,158,11,0.9);
          margin-bottom: 14px;
        }
        .hr-voice-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px;
          color: #f87171;
          margin-bottom: 14px;
        }
      `}</style>
    </div>
  );
}
