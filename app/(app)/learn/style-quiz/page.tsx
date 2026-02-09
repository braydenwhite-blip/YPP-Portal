"use client";

import { useState } from "react";

const QUESTIONS = [
  {
    q: "When learning something new, I prefer to:",
    options: [
      { text: "Watch videos or demonstrations", style: "visual" },
      { text: "Listen to explanations or podcasts", style: "auditory" },
      { text: "Try it hands-on myself", style: "kinesthetic" },
      { text: "Read instructions or articles", style: "reading" }
    ]
  },
  {
    q: "I remember things best when:",
    options: [
      { text: "I see pictures or diagrams", style: "visual" },
      { text: "I hear them explained", style: "auditory" },
      { text: "I practice doing them", style: "kinesthetic" },
      { text: "I write them down", style: "reading" }
    ]
  },
  {
    q: "I learn better when I:",
    options: [
      { text: "Work with others in a group", style: "social" },
      { text: "Study alone at my own pace", style: "solitary" },
      { text: "Have someone teach me directly", style: "auditory" },
      { text: "Figure it out myself", style: "kinesthetic" }
    ]
  }
];

export default function LearningStyleQuizPage() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});

  const handleAnswer = (style: string) => {
    const newAnswers = [...answers, style];
    setAnswers(newAnswers);

    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      calculateResults(newAnswers);
    }
  };

  const calculateResults = (allAnswers: string[]) => {
    const scores: Record<string, number> = {};
    allAnswers.forEach(style => {
      scores[style] = (scores[style] || 0) + 1;
    });
    setResults(scores);
    setComplete(true);
  };

  const topStyle = Object.entries(results).sort(([,a], [,b]) => b - a)[0];

  const styleInfo: Record<string, any> = {
    visual: { name: "Visual Learner", icon: "👁️", tip: "Use diagrams, videos, and color-coding" },
    auditory: { name: "Auditory Learner", icon: "👂", tip: "Listen to podcasts, explain out loud" },
    kinesthetic: { name: "Hands-On Learner", icon: "✋", tip: "Practice doing, use real materials" },
    reading: { name: "Reading/Writing Learner", icon: "📖", tip: "Take notes, read articles" },
    social: { name: "Social Learner", icon: "👥", tip: "Study groups, teach others" },
    solitary: { name: "Independent Learner", icon: "🧘", tip: "Self-paced, quiet environment" }
  };

  if (complete && topStyle) {
    const info = styleInfo[topStyle[0]];
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
        <div className="card" style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 72 }}>{info.icon}</div>
          <h1 style={{ fontSize: 32, marginTop: 16 }}>You're a {info.name}!</h1>
          <p style={{ fontSize: 18, marginTop: 12, color: "var(--text-secondary)" }}>
            {info.tip}
          </p>
        </div>

        <div className="card">
          <h3>Your Learning Recommendations:</h3>
          <ul style={{ marginTop: 12, marginLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>Focus on {info.name.toLowerCase()} resources</li>
            <li style={{ marginBottom: 8 }}>Try different approaches when stuck</li>
            <li>Combine your natural style with other methods</li>
          </ul>
          <a href="/learn/modules" className="button primary" style={{ marginTop: 20, width: "100%" }}>
            Browse Learning Modules
          </a>
        </div>
      </div>
    );
  }

  const question = QUESTIONS[current];

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Question {current + 1} of {QUESTIONS.length}
          </span>
        </div>
        <h2 style={{ marginBottom: 24 }}>{question.q}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt.style)}
              className="button secondary"
              style={{ width: "100%", padding: 16, textAlign: "left" }}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
