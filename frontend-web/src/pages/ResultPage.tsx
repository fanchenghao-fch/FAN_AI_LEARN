import { useNavigate } from "react-router-dom";
import { useQuizStore } from "../stores/quizStore";
import type { QuizResult, WrongQuestionDetail } from "../types/quiz";
import Mascot from "../components/Mascot";
import "../styles/result.css";

function getGrade(acc: number): { emoji: string; label: string; color: string } {
  if (acc >= 0.9) return { emoji: "🏆", label: "学霸级！", color: "var(--yellow)" };
  if (acc >= 0.8) return { emoji: "🌟", label: "非常棒！", color: "var(--green)" };
  if (acc >= 0.6) return { emoji: "👍", label: "表现不错！", color: "var(--blue)" };
  if (acc >= 0.4) return { emoji: "💪", label: "继续加油！", color: "var(--orange)" };
  return { emoji: "📚", label: "需要多练练~", color: "var(--purple)" };
}

export default function ResultPage() {
  const navigate = useNavigate();
  const result = useQuizStore((s) => s.result);
  const session = useQuizStore((s) => s.session);
  const resetSession = useQuizStore((s) => s.resetSession);

  // Build local result if AI analysis not done
  const display: QuizResult | null = result || (() => {
    if (!session.quiz_id) return null;
    const correct = session.answers.filter((a) => a.is_correct).length;
    const total = session.questions.length;
    const wrong: WrongQuestionDetail[] = session.answers.filter((a) => !a.is_correct).map((a) => {
      const q = session.questions.find((q) => q.id === a.question_id);
      return { question_id: a.question_id, content: q?.content || "", user_answer: a.user_answer, correct_answer: q?.correct_answer || "", explanation: q?.explanation || "" };
    });
    return { quiz_id: session.quiz_id, title: session.title, score: correct, total_questions: total, accuracy: total > 0 ? Math.round((correct / total) * 100) / 100 : 0, total_time: 0, knowledge_summary: [], wrong_questions: wrong, mastery_radar: {}, study_suggestion: "" };
  })();

  if (!display) return <div className="app-phone-frame"><div className="app-phone-content">加载结果中...</div></div>;

  const { emoji, label, color } = getGrade(display.accuracy);
  const mastery = Object.entries(display.mastery_radar || {});

  const handleRetry = () => { resetSession(); navigate("/", { replace: true }); };

  return (
    <div className="app-phone-frame">
      <div className="app-phone-content result-page" style={{ overflowY: "auto" }}>
        <div className="result-hero">
          <div className="result-grade"><span className="grade-emoji">{emoji}</span><span style={{ color }}>{label}</span></div>
          <div className="result-score-ring">
            <svg viewBox="0 0 120 120" style={{ position: "absolute", inset: 0 }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" strokeWidth="10"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${display.accuracy * 314} 314`} transform="rotate(-90 60 60)"/>
            </svg>
            <span className="score-text">{display.score}/{display.total_questions}</span>
          </div>
          <div className="result-stats">
            <div className="result-stat"><span className="stat-val">{Math.round(display.accuracy * 100)}%</span><span className="stat-label">正确率</span></div>
            <div className="result-stat"><span className="stat-val">{display.total_time}s</span><span className="stat-label">用时</span></div>
            <div className="result-stat"><span className="stat-val">#{session.max_combo}</span><span className="stat-label">最高连击</span></div>
          </div>
          <div className="result-mascot"><Mascot mood={display.accuracy >= 0.6 ? "happy" : "encouraging"} size={70}/></div>
        </div>

        <div className="result-actions">
          <button className="comic-btn primary" onClick={handleRetry}>再来一局</button>
          <button className="comic-btn outline" onClick={() => alert("分享功能即将上线")}>分享成绩</button>
        </div>

        {mastery.length > 0 && (
          <div className="mastery-section">
            <div className="summary-header">📊 掌握度分析</div>
            {mastery.map(([dim, score]) => (
              <div key={dim} className="mastery-item">
                <span className="mastery-label">{dim}</span>
                <div className="mastery-bar-wrap"><div className="mastery-bar-fill" style={{ width: `${Math.round((score as number) * 100)}%`, background: (score as number) >= 0.8 ? "var(--green)" : (score as number) >= 0.6 ? "var(--blue)" : "var(--yellow)" }}/></div>
                <span className="mastery-val">{Math.round((score as number) * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {display.knowledge_summary.length > 0 && (
          <div>
            <div className="summary-header">💡 知识要点总结</div>
            <div className="knowledge-points">
              {display.knowledge_summary.map((p, i) => (
                <div key={i} className="knowledge-point"><div className="kp-num">{i + 1}</div><span className="kp-text">{p}</span></div>
              ))}
            </div>
          </div>
        )}

        {display.study_suggestion && (
          <div className="study-suggestion-card"><span className="sug-icon">🎯</span><span className="sug-text">{display.study_suggestion}</span></div>
        )}

        <div className="wrong-review-section">
          <div className="summary-header">❌ 错题回顾</div>
          {display.wrong_questions.length === 0 ? (
            <div className="empty-wrong"><span className="empty-icon">🎉</span><span className="empty-text">全部答对！你太厉害了！</span></div>
          ) : (
            display.wrong_questions.map((wq, i) => (
              <div key={i} className="wrong-review-item">
                <div className="wrong-q">{i + 1}. {wq.content}</div>
                <div className="wrong-answers">你的答案：<span className="user-wrong">{wq.user_answer}</span> | 正确答案：<span className="correct-ans">{wq.correct_answer}</span></div>
                <div style={{ fontSize: "0.78rem", color: "var(--dark)", marginTop: "4px" }}>{wq.explanation}</div>
              </div>
            ))
          )}
        </div>

        <button className="comic-btn primary" style={{ width: "100%", marginBottom: "16px" }} onClick={handleRetry}>🔄 再来一局</button>
      </div>
    </div>
  );
}
