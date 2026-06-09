import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuizStore } from "../stores/quizStore";
import { useTimer } from "../hooks/useTimer";
import { analyzeQuiz } from "../services/api";
import type { Question, QuizAnalyzeRequest } from "../types/quiz";
import Mascot from "../components/Mascot";
import "../styles/quiz.css";

function LifePotion() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <rect x="4" y="2" width="16" height="4" rx="1" fill="#FBBF24" stroke="#1E1E1E" strokeWidth="1.5"/>
      <rect x="7" y="6" width="10" height="14" rx="3" fill="#FBBF24" stroke="#1E1E1E" strokeWidth="1.5"/>
      <circle cx="10" cy="12" r="2" fill="#FEF3C7"/>
    </svg>
  );
}

export default function QuizPage() {
  const navigate = useNavigate();
  const session = useQuizStore((s) => s.session);
  const submitAnswer = useQuizStore((s) => s.submitAnswer);
  const goToNext = useQuizStore((s) => s.goToNextQuestion);
  const goToPrev = useQuizStore((s) => s.goToPrevQuestion);
  const setResult = useQuizStore((s) => s.setResult);
  const lastCorrect = useQuizStore((s) => s.lastAnswerCorrect);
  const showExplanation = useQuizStore((s) => s.showExplanation);
  const combo = useQuizStore((s) => s.session.combo);
  const answers = useQuizStore((s) => s.session.answers);
  const currentIdx = useQuizStore((s) => s.session.current_index);
  const questions = useQuizStore((s) => s.session.questions);

  const [selected, setSelected] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const timer = useTimer();

  const q: Question | null = questions[currentIdx] || null;
  const total = questions.length;
  const progress = total > 0 ? Math.round((answers.length / total) * 100) : 0;
  const isComplete = answers.length >= total && total > 0;

  useEffect(() => { setSelected(null); timer.reset(); timer.start(); return () => { timer.stop(); }; }, [currentIdx]);

  const handleAnswer = useCallback((answer: string) => {
    if (showExplanation || selected || !q) return;
    setSelected(answer);
    const spent = timer.stop();
    submitAnswer(q.id, answer, spent);
  }, [showExplanation, selected, q, timer, submitAnswer]);

  const handleNext = useCallback(async () => {
    if (isComplete) {
      setAnalyzing(true);
      try {
        const req: QuizAnalyzeRequest = {
          quiz_id: session.quiz_id,
          questions: questions.map((q) => ({ id: q.id, content: q.content, correct_answer: q.correct_answer, explanation: q.explanation, difficulty: q.difficulty, type: q.type })),
          answers: answers.map((a) => ({ question_id: a.question_id, user_answer: a.user_answer, is_correct: a.is_correct, time_spent: a.time_spent })),
          total_time: timer.elapsed,
        };
        const resp = await analyzeQuiz(req);
        if (resp.code === 0 && resp.data) setResult(resp.data);
      } catch (e) { console.error(e); }
      navigate("/result", { replace: true });
    } else {
      goToNext();
      setSelected(null);
    }
  }, [isComplete, session.quiz_id, questions, answers, goToNext, setResult, timer, navigate]);

  if (!q) return <div className="app-phone-frame"><div className="app-phone-content">题目加载中...</div></div>;

  const isChoice = q.type === "choice";
  const gradeEmoji = lastCorrect === true ? "🎉" : lastCorrect === false ? "😅" : "";

  return (
    <div className="app-phone-frame">
      <div className="app-phone-content quiz-page">
        <div className="status-bar-spacer" />

        <div className="quiz-top-bar">
          <div className="exit-btn" onClick={() => { if (confirm("退出后进度将丢失，确定退出？")) navigate("/", { replace: true }); }}>
            ✕
          </div>
          <div className="quiz-progress-info"><span style={{ fontFamily: "var(--font-display)" }}>第 {currentIdx + 1}/{total} 题</span></div>
          <div className="lives-display"><LifePotion/><LifePotion/><LifePotion/></div>
        </div>

        <div className="quiz-progress">
          <div className="progress-label"><span>闯关进度</span><span>{progress}%</span></div>
          <div className="progress-bar"><div className={`fill ${lastCorrect === null ? "blue" : lastCorrect ? "green" : "yellow"}`} style={{ width: `${progress}%` }}/></div>
        </div>

        <div className="combo-indicator">
          {combo >= 3 && <span className="combo-count">🔥 连击 ×{combo}</span>}
        </div>

        <div className="question-card">
          <div className={`question-type-badge${!isChoice ? " tf" : ""}`}>{isChoice ? "单选题" : "判断题"}</div>
          <div className="question-text">{q.content}</div>
          <div className="question-timer">⏱ 本题用时 {timer.elapsed}s</div>
        </div>

        {isChoice && q.options && (
          <div className="options-list">
            {q.options.map((opt) => {
              let cls = "option-btn";
              if (showExplanation) {
                if (opt.key === q.correct_answer) cls += " correct";
                else if (opt.key === selected && opt.key !== q.correct_answer) cls += " wrong";
                else cls += " dimmed";
              } else if (selected === opt.key) cls += " selected";
              return (
                <div key={opt.key} className={cls} onClick={() => handleAnswer(opt.key)}>
                  <div className="opt-key" style={showExplanation && opt.key === q.correct_answer ? { background: "var(--green)", color: "white" } : undefined}>{opt.key}</div>
                  <span>{opt.text}</span>
                  {showExplanation && opt.key === q.correct_answer && <span style={{ marginLeft: "auto" }}>✓</span>}
                </div>
              );
            })}
          </div>
        )}

        {!isChoice && (
          <div className="truefalse-row">
            <div className={`truefalse-btn t-btn${selected === "正确" ? " selected" : ""}`} onClick={() => handleAnswer("正确")}>✅ 正确</div>
            <div className={`truefalse-btn f-btn${selected === "错误" ? " selected" : ""}`} onClick={() => handleAnswer("错误")}>❌ 错误</div>
          </div>
        )}

        {showExplanation && (
          <>
            <div className={`explanation-card${lastCorrect ? "" : " wrong"}`}>
              <div className="exp-title">{lastCorrect ? "✅ 回答正确！" : "❌ 回答错误"}</div>
              <div className="exp-text">{q.explanation}</div>
            </div>
            <div className="mascot-feedback">
              <Mascot mood={lastCorrect ? "happy" : "encouraging"} size={50}/>
              <div className="speech-bubble">
                <strong>灯灯：</strong>{lastCorrect ? (combo >= 3 ? `太厉害了！连对 ${combo} 题！` : "答对了！") : "没关系，看看正确答案～"}
              </div>
            </div>
          </>
        )}

        {isComplete && showExplanation && (
          <div className="quiz-complete-banner">
            <div className="complete-title">🎉 闯关完成！</div>
            <div className="complete-score">{answers.filter((a) => a.is_correct).length}/{total}</div>
          </div>
        )}

        {showExplanation ? (
          <button className="comic-btn primary next-btn" onClick={handleNext} disabled={analyzing}>
            {isComplete ? "查看分析报告" : "下一题"}
          </button>
        ) : (
          <div className="action-row">
            <button className="comic-btn outline sm" onClick={() => handleNext()}>跳过</button>
            <button className="comic-btn outline sm" onClick={goToPrev} disabled={currentIdx === 0}>上一题</button>
          </div>
        )}
      </div>
    </div>
  );
}
