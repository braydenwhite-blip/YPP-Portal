"use client";

import { memo, useState, useCallback } from "react";
import styles from "../passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// Passion Discovery Quiz Panel — In-world quiz overlay
// ═══════════════════════════════════════════════════════════════

const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "When you have free time, what sounds most exciting?",
    options: [
      { text: "Creating something with my hands", passions: ["ARTS", "TRADES"] },
      { text: "Playing sports or being active", passions: ["SPORTS", "HEALTH_WELLNESS"] },
      { text: "Learning how things work or solving puzzles", passions: ["STEM"] },
      { text: "Helping others or community projects", passions: ["SERVICE"] },
      { text: "Performing or making people laugh", passions: ["ENTERTAINMENT", "MUSIC"] },
      { text: "Writing stories or creating content", passions: ["WRITING"] },
    ],
  },
  {
    id: 2,
    question: "What makes you lose track of time?",
    options: [
      { text: "Drawing, painting, or designing", passions: ["ARTS"] },
      { text: "Physical activities and movement", passions: ["SPORTS", "HEALTH_WELLNESS"] },
      { text: "Experiments, coding, or building", passions: ["STEM", "TRADES"] },
      { text: "Talking with friends & meeting people", passions: ["SERVICE", "BUSINESS"] },
      { text: "Playing music or rehearsing", passions: ["MUSIC", "ENTERTAINMENT"] },
      { text: "Reading or creating stories", passions: ["WRITING"] },
    ],
  },
  {
    id: 3,
    question: "What achievement would make you proudest?",
    options: [
      { text: "Creating a beautiful piece of art", passions: ["ARTS"] },
      { text: "Winning a competition", passions: ["SPORTS"] },
      { text: "Inventing something new", passions: ["STEM"] },
      { text: "Making a difference in someone's life", passions: ["SERVICE"] },
      { text: "Performing in front of an audience", passions: ["ENTERTAINMENT", "MUSIC"] },
      { text: "Writing a story that moves people", passions: ["WRITING"] },
    ],
  },
  {
    id: 4,
    question: "How do you prefer to learn new things?",
    options: [
      { text: "Watching videos and tutorials", passions: ["ARTS", "STEM", "TRADES"] },
      { text: "Doing it myself and practicing", passions: ["SPORTS", "MUSIC", "TRADES"] },
      { text: "Reading books and articles", passions: ["WRITING", "STEM"] },
      { text: "Working with others in a group", passions: ["SERVICE", "BUSINESS"] },
      { text: "Trying different approaches", passions: ["STEM", "ARTS", "ENTERTAINMENT"] },
    ],
  },
  {
    id: 5,
    question: "What sounds like the best Saturday?",
    options: [
      { text: "Working on a creative project", passions: ["ARTS", "WRITING", "MUSIC"] },
      { text: "Playing sports or exercising", passions: ["SPORTS", "HEALTH_WELLNESS"] },
      { text: "Tinkering, coding, or building", passions: ["STEM", "TRADES"] },
      { text: "Volunteering in the community", passions: ["SERVICE"] },
      { text: "Practicing for a performance", passions: ["ENTERTAINMENT", "MUSIC"] },
      { text: "Learning a new skill or hobby", passions: ["ARTS", "STEM", "MUSIC", "TRADES"] },
    ],
  },
];

const PASSION_INFO: Record<string, { name: string; icon: string; color: string }> = {
  ARTS: { name: "Arts & Visual Creation", icon: "\u{1F3A8}", color: "#FF6B6B" },
  SPORTS: { name: "Sports & Athletics", icon: "\u26BD", color: "#4ECDC4" },
  STEM: { name: "Science & Technology", icon: "\u{1F52C}", color: "#45B7D1" },
  BUSINESS: { name: "Business & Leadership", icon: "\u{1F4BC}", color: "#F7B731" },
  SERVICE: { name: "Community Service", icon: "\u{1F91D}", color: "#5F27CD" },
  HEALTH_WELLNESS: { name: "Health & Wellness", icon: "\u{1F9D8}", color: "#00D2D3" },
  TRADES: { name: "Hands-On Trades", icon: "\u{1F527}", color: "#FD7272" },
  ENTERTAINMENT: { name: "Entertainment", icon: "\u{1F3AD}", color: "#FF9FF3" },
  WRITING: { name: "Writing & Communication", icon: "\u270D\uFE0F", color: "#54A0FF" },
  MUSIC: { name: "Music", icon: "\u{1F3B5}", color: "#48DBFB" },
};

interface DiscoveryQuizPanelProps {
  onClose: () => void;
  onIslandsCreated?: () => void;
}

export const DiscoveryQuizPanel = memo(function DiscoveryQuizPanel({ onClose, onIslandsCreated }: DiscoveryQuizPanelProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});
  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const [islandsCreated, setIslandsCreated] = useState(0);
  const [saving, setSaving] = useState(false);

  const calculateResults = useCallback((allAnswers: number[]) => {
    const scores: Record<string, number> = {};
    allAnswers.forEach((answerIndex, questionIndex) => {
      const question = QUIZ_QUESTIONS[questionIndex];
      const selectedOption = question.options[answerIndex];
      selectedOption.passions.forEach((passion) => {
        scores[passion] = (scores[passion] || 0) + 1;
      });
    });
    setResults(scores);
    setIsComplete(true);

    // Save results to backend
    setSaving(true);
    fetch("/api/discover/quiz/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores, quizType: "DISCOVERY" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.xpEarned) setXpEarned(data.xpEarned);
        if (data.islandsCreated > 0) {
          setIslandsCreated(data.islandsCreated);
          onIslandsCreated?.();
        }
      })
      .catch((err) => console.error("[DiscoveryQuiz] save error:", err))
      .finally(() => setSaving(false));
  }, []);

  const handleAnswer = useCallback((optionIndex: number) => {
    setAnswers((prev) => {
      const newAnswers = [...prev, optionIndex];
      if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
        setCurrentQuestion((q) => q + 1);
      } else {
        calculateResults(newAnswers);
      }
      return newAnswers;
    });
  }, [currentQuestion, calculateResults]);

  const handleBack = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((q) => q - 1);
      setAnswers((prev) => prev.slice(0, -1));
    }
  }, [currentQuestion]);

  const topPassions = Object.entries(results)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const progress = ((currentQuestion + (isComplete ? 1 : 0)) / QUIZ_QUESTIONS.length) * 100;

  return (
    <div
      className={styles.panel}
      style={{ borderColor: "#a855f7", maxHeight: "80vh", overflowY: "auto" }}
      role="dialog"
      aria-label="Passion Discovery Quiz"
      aria-modal="false"
    >
      <div className={styles.panelDragHandle} aria-hidden="true">
        <div className={styles.panelDragBar} />
      </div>
      <button className={styles.panelClose} onClick={onClose} aria-label="Close quiz">
        &times;
      </button>
      <div
        className={styles.panelHeader}
        style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}
      >
        <span className={styles.panelEmoji}>{"\u{1FA84}"}</span>
        <div>
          <h3 className={styles.panelTitle}>Passion Discovery</h3>
          <span className={styles.panelSubtitle}>
            Find your island passions
          </span>
        </div>
      </div>

      <div className={styles.panelBody}>
        {/* Progress bar */}
        <div className={styles.quizProgress}>
          <div className={styles.quizProgressBar}>
            <div
              className={styles.quizProgressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.quizProgressText}>
            {isComplete
              ? "Complete!"
              : `${currentQuestion + 1} / ${QUIZ_QUESTIONS.length}`}
          </div>
        </div>

        {isComplete ? (
          /* ─── Results ─── */
          <div className={styles.quizResults}>
            {xpEarned && (
              <div className={styles.quizXpBanner}>
                +{xpEarned} XP earned!
              </div>
            )}
            {islandsCreated > 0 && (
              <div className={styles.quizXpBanner} style={{ color: "#4ade80" }}>
                {islandsCreated} new island{islandsCreated > 1 ? "s" : ""} created!
              </div>
            )}
            <div className={styles.quizResultsTitle}>Your Top Passions</div>
            {topPassions.map(([passion, score], index) => {
              const info = PASSION_INFO[passion];
              if (!info) return null;
              const pct = Math.round((score / QUIZ_QUESTIONS.length) * 100);
              return (
                <div key={passion} className={styles.quizResultCard}>
                  <div className={styles.quizResultIcon}>{info.icon}</div>
                  <div className={styles.quizResultInfo}>
                    <div className={styles.quizResultName}>
                      {info.name}
                      {index === 0 && (
                        <span className={styles.quizTopMatch}>Top Match</span>
                      )}
                    </div>
                    <div className={styles.quizResultBar}>
                      <div
                        className={styles.quizResultBarFill}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: info.color,
                        }}
                      />
                    </div>
                    <div className={styles.quizResultPct}>{pct}% match</div>
                  </div>
                </div>
              );
            })}
            {saving && (
              <div className={styles.quizSaving}>Saving results...</div>
            )}
            <button
              className={styles.quizDoneBtn}
              onClick={onClose}
            >
              Back to World
            </button>
          </div>
        ) : (
          /* ─── Question ─── */
          <div className={styles.quizQuestion}>
            <div className={styles.quizQuestionText}>
              {QUIZ_QUESTIONS[currentQuestion].question}
            </div>
            <div className={styles.quizOptions}>
              {QUIZ_QUESTIONS[currentQuestion].options.map((option, index) => (
                <button
                  key={index}
                  className={styles.quizOption}
                  onClick={() => handleAnswer(index)}
                >
                  {option.text}
                </button>
              ))}
            </div>
            {currentQuestion > 0 && (
              <button
                className={styles.quizBackBtn}
                onClick={handleBack}
              >
                &larr; Previous
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
