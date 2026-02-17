"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Sample quiz questions - in production these would come from database
const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "When you have free time, what sounds most exciting?",
    options: [
      { text: "Creating something with my hands (art, crafts, building)", passions: ["ARTS", "TRADES"] },
      { text: "Playing sports or being active outdoors", passions: ["SPORTS", "HEALTH_WELLNESS"] },
      { text: "Learning how things work or solving puzzles", passions: ["STEM"] },
      { text: "Helping others or working on community projects", passions: ["SERVICE"] },
      { text: "Performing, entertaining, or making people laugh", passions: ["ENTERTAINMENT", "MUSIC"] },
      { text: "Writing stories, journals, or creating content", passions: ["WRITING"] }
    ]
  },
  {
    id: 2,
    question: "What makes you lose track of time?",
    options: [
      { text: "Drawing, painting, or designing", passions: ["ARTS"] },
      { text: "Physical activities and movement", passions: ["SPORTS", "HEALTH_WELLNESS"] },
      { text: "Experiments, coding, or building things", passions: ["STEM", "TRADES"] },
      { text: "Talking with friends and meeting new people", passions: ["SERVICE", "BUSINESS"] },
      { text: "Playing music or practicing performances", passions: ["MUSIC", "ENTERTAINMENT"] },
      { text: "Reading or creating stories", passions: ["WRITING"] }
    ]
  },
  {
    id: 3,
    question: "What kind of achievement would make you proudest?",
    options: [
      { text: "Creating a beautiful piece of art", passions: ["ARTS"] },
      { text: "Winning a competition or breaking a personal record", passions: ["SPORTS"] },
      { text: "Inventing or discovering something new", passions: ["STEM"] },
      { text: "Making a positive difference in someone's life", passions: ["SERVICE"] },
      { text: "Performing in front of an audience", passions: ["ENTERTAINMENT", "MUSIC"] },
      { text: "Writing a story that moves people", passions: ["WRITING"] }
    ]
  },
  {
    id: 4,
    question: "How do you prefer to learn new things?",
    options: [
      { text: "By watching videos and tutorials", passions: ["ARTS", "STEM", "TRADES"] },
      { text: "By doing it myself and practicing", passions: ["SPORTS", "MUSIC", "TRADES"] },
      { text: "By reading books and articles", passions: ["WRITING", "STEM"] },
      { text: "By working with others in a group", passions: ["SERVICE", "BUSINESS"] },
      { text: "By trying different approaches until something works", passions: ["STEM", "ARTS", "ENTERTAINMENT"] }
    ]
  },
  {
    id: 5,
    question: "What sounds like the best way to spend a Saturday?",
    options: [
      { text: "Working on a creative project", passions: ["ARTS", "WRITING", "MUSIC"] },
      { text: "Playing sports or exercising", passions: ["SPORTS", "HEALTH_WELLNESS"] },
      { text: "Tinkering with electronics, coding, or building", passions: ["STEM", "TRADES"] },
      { text: "Volunteering or helping in the community", passions: ["SERVICE"] },
      { text: "Practicing for a performance or show", passions: ["ENTERTAINMENT", "MUSIC"] },
      { text: "Learning a new skill or hobby", passions: ["ARTS", "STEM", "MUSIC", "TRADES"] }
    ]
  }
];

const PASSION_INFO = {
  ARTS: { name: "Arts & Visual Creation", icon: "🎨", color: "#FF6B6B" },
  SPORTS: { name: "Sports & Athletics", icon: "⚽", color: "#4ECDC4" },
  STEM: { name: "Science & Technology", icon: "🔬", color: "#45B7D1" },
  BUSINESS: { name: "Business & Leadership", icon: "💼", color: "#F7B731" },
  SERVICE: { name: "Community Service", icon: "🤝", color: "#5F27CD" },
  HEALTH_WELLNESS: { name: "Health & Wellness", icon: "🧘", color: "#00D2D3" },
  TRADES: { name: "Hands-On Trades", icon: "🔧", color: "#FD7272" },
  ENTERTAINMENT: { name: "Entertainment & Performance", icon: "🎭", color: "#FF9FF3" },
  WRITING: { name: "Writing & Communication", icon: "✍️", color: "#54A0FF" },
  MUSIC: { name: "Music", icon: "🎵", color: "#48DBFB" }
};

export default function PassionQuizPage() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);

    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Quiz complete - calculate results
      calculateResults(newAnswers);
    }
  };

  const calculateResults = (allAnswers: number[]) => {
    const scores: Record<string, number> = {};

    allAnswers.forEach((answerIndex, questionIndex) => {
      const question = QUIZ_QUESTIONS[questionIndex];
      const selectedOption = question.options[answerIndex];
      
      selectedOption.passions.forEach(passion => {
        scores[passion] = (scores[passion] || 0) + 1;
      });
    });

    setResults(scores);
    setIsComplete(true);

    // Save results to backend
    saveResults(scores);
  };

  const saveResults = async (scores: Record<string, number>) => {
    try {
      await fetch('/api/discover/quiz/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores, quizType: 'DISCOVERY' })
      });
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const topPassions = Object.entries(results)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (isComplete) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
        <div className="card" style={{ marginBottom: 28, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>🎉 Your Passion Profile!</h1>
          <p style={{ fontSize: 18, color: "var(--text-secondary)" }}>
            Based on your answers, here are your top interests:
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
          {topPassions.map(([passion, score], index) => {
            const info = PASSION_INFO[passion as keyof typeof PASSION_INFO];
            const percentage = Math.round((score / QUIZ_QUESTIONS.length) * 100);
            
            return (
              <div 
                key={passion}
                className="card"
                style={{
                  borderLeft: `4px solid ${info.color}`,
                  padding: 24
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 48 }}>{info.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <h2 style={{ margin: 0 }}>{info.name}</h2>
                      {index === 0 && (
                        <span className="pill success">Top Match!</span>
                      )}
                    </div>
                    <div style={{ 
                      marginTop: 8,
                      height: 8,
                      backgroundColor: "var(--accent-bg)",
                      borderRadius: 4,
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${percentage}%`,
                        backgroundColor: info.color,
                        borderRadius: 4,
                        transition: "width 0.5s ease"
                      }} />
                    </div>
                    <div style={{ fontSize: 14, marginTop: 4, color: "var(--text-secondary)" }}>
                      {percentage}% match
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3>Next Steps:</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <a href="/discover/try-it" className="button primary" style={{ textAlign: "center" }}>
              Watch Try-It Videos
            </a>
            <a href="/challenges" className="button secondary" style={{ textAlign: "center" }}>
              Explore Portal Challenges
            </a>
            <a href="/world" className="button secondary" style={{ textAlign: "center" }}>
              Open Passion World
            </a>
          </div>
        </div>
      </div>
    );
  }

  const question = QUIZ_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
            </span>
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div style={{
            height: 8,
            backgroundColor: "var(--accent-bg)",
            borderRadius: 4,
            overflow: "hidden"
          }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: "var(--primary-color)",
              borderRadius: 4,
              transition: "width 0.3s ease"
            }} />
          </div>
        </div>

        <h2 style={{ fontSize: 24, marginBottom: 24 }}>{question.question}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(index)}
              className="button secondary"
              style={{
                width: "100%",
                padding: 16,
                textAlign: "left",
                fontSize: 16,
                border: "2px solid var(--border-color)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--primary-color)";
                e.currentTarget.style.backgroundColor = "var(--accent-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>

      {currentQuestion > 0 && (
        <button
          onClick={() => {
            setCurrentQuestion(currentQuestion - 1);
            setAnswers(answers.slice(0, -1));
          }}
          className="button secondary"
          style={{ width: "100%" }}
        >
          ← Previous Question
        </button>
      )}
    </div>
  );
}
