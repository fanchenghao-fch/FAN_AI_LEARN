/**
 * Page ③④⑤⑥: 答题页 + 反馈 (Choice + TrueFalse + Correct + Wrong)
 *
 * Single page handling all 4 states from the prototype:
 * - ③ 选择题答题 (Choice Question)
 * - ④ 判断题答题 (True/False Question)
 * - ⑤ 答对反馈 + 知识讲解 (Correct Feedback)
 * - ⑥ 答错反馈 + 错题讲解 (Wrong Feedback)
 *
 * All SVG icons replaced with emoji for WeChat Mini Program compatibility.
 */

import { useState, useCallback, useEffect } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useQuizStore } from "../../stores/quizStore";
import { useUIStore } from "../../stores/uiStore";
import { useQuizEngine } from "../../hooks/useQuizEngine";
import { useTimer } from "../../hooks/useTimer";
import { analyzeQuiz } from "../../services/api";
import type { Question, QuizAnalyzeRequest } from "../../types/quiz";
import "./index.scss";

// ── Sub-components ──────────────────────────────────────────

/** Life Potion icon — emoji replacement for SVG */
function LifePotion({ lost = false }: { lost?: boolean }) {
  return (
    <Text className={`life-icon${lost ? " lost" : ""}`}>
      {lost ? "🫗" : "🧪"}
    </Text>
  );
}

/** Close/X icon button — emoji replacement */
function ExitButton({ onClick }: { onClick: () => void }) {
  return (
    <View className="exit-btn" onClick={onClick}>
      <Text className="exit-icon">✕</Text>
    </View>
  );
}

// ── Page Component ──────────────────────────────────────────

export default function QuizPage() {
  const session = useQuizStore((s) => s.session);
  const submitAnswer = useQuizStore((s) => s.submitAnswer);
  const goToNextQuestion = useQuizStore((s) => s.goToNextQuestion);
  const goToPrevQuestion = useQuizStore((s) => s.goToPrevQuestion);
  const setResult = useQuizStore((s) => s.setResult);

  const lastAnswerCorrect = useQuizStore((s) => s.lastAnswerCorrect);
  const showExplanation = useQuizStore((s) => s.showExplanation);
  const combo = useQuizStore((s) => s.session.combo);
  const answers = useQuizStore((s) => s.session.answers);
  const currentIndex = useQuizStore((s) => s.session.current_index);
  const questions = useQuizStore((s) => s.session.questions);

  const setMascotMood = useUIStore((s) => s.setMascotMood);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const timer = useTimer();

  const currentQuestion: Question | null = questions[currentIndex] || null;
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? Math.round(((answers.length) / totalQuestions) * 100) : 0;
  const isCompleted = answers.length >= totalQuestions && totalQuestions > 0;

  // Reset timer and selection when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    timer.reset();
    timer.start();
    return () => { timer.stop(); };
  }, [currentIndex]);

  /** Handle option selection for choice questions */
  const handleSelectChoice = useCallback((answerKey: string) => {
    if (showExplanation || selectedAnswer) return;

    setSelectedAnswer(answerKey);
    const timeSpent = timer.stop();
    const isCorrect = answerKey === currentQuestion?.correct_answer;

    setMascotMood(isCorrect ? "happy" : "encouraging");
    submitAnswer(currentQuestion!.id, answerKey, timeSpent);
  }, [showExplanation, selectedAnswer, currentQuestion, timer, setMascotMood, submitAnswer]);

  /** Handle true/false selection */
  const handleSelectTF = useCallback((answer: string) => {
    if (showExplanation || selectedAnswer) return;

    setSelectedAnswer(answer);
    const timeSpent = timer.stop();
    const isCorrect = answer === currentQuestion?.correct_answer;

    setMascotMood(isCorrect ? "happy" : "encouraging");
    submitAnswer(currentQuestion!.id, answer, timeSpent);
  }, [showExplanation, selectedAnswer, currentQuestion, timer, setMascotMood, submitAnswer]);

  /** Go to next question or analyze results */
  const handleNext = useCallback(async () => {
    if (isCompleted) {
      // Analyze results
      setIsAnalyzing(true);
      try {
        const analyzeReq: QuizAnalyzeRequest = {
          quiz_id: session.quiz_id,
          questions: questions.map((q) => ({
            id: q.id,
            content: q.content,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            difficulty: q.difficulty,
            type: q.type,
          })),
          answers: answers.map((a) => ({
            question_id: a.question_id,
            user_answer: a.user_answer,
            is_correct: a.is_correct,
            time_spent: a.time_spent,
          })),
          total_time: timer.elapsed,
        };

        const response = await analyzeQuiz(analyzeReq);
        if (response.code === 0 && response.data) {
          setResult(response.data);
        }
        Taro.redirectTo({ url: "/pages/result/index" });
      } catch (error) {
        console.error("Analysis failed:", error);
        // Navigate anyway with what we have locally
        Taro.redirectTo({ url: "/pages/result/index" });
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      goToNextQuestion();
      setSelectedAnswer(null);
      setMascotMood("normal");
    }
  }, [isCompleted, session.quiz_id, questions, answers, goToNextQuestion, setMascotMood, timer, setResult]);

  /** Handle skip */
  const handleSkip = useCallback(() => {
    handleNext();
  }, [handleNext]);

  /** Handle exit */
  const handleExit = useCallback(() => {
    Taro.showModal({
      title: "确认退出",
      content: "退出后当前闯关进度将丢失，确定要退出吗？",
      success: (res) => {
        if (res.confirm) {
          Taro.redirectTo({ url: "/pages/index/index" });
        }
      },
    });
  }, []);

  // Guard: no questions loaded
  if (!currentQuestion) {
    return (
      <View className="app-phone-frame">
        <View className="app-phone-content">
          <Text>题目加载中...</Text>
        </View>
      </View>
    );
  }

  const isChoice = currentQuestion.type === "choice";
  const isTrueFalse = currentQuestion.type === "truefalse";

  return (
    <View className="app-phone-frame" style={{ position: "relative" }}>
      {/* Speed lines background */}
      {showExplanation && (
        <View className="comic-speedlines">
          <View className="ray" /><View className="ray" /><View className="ray" />
          <View className="ray" /><View className="ray" />
        </View>
      )}

      <View className="app-phone-content quiz-page">
        <View className="status-bar-spacer" />

        {/* === Top Bar === */}
        <View className="quiz-top-bar">
          <ExitButton onClick={handleExit} />
          <View className="quiz-progress-info">
            <Text style={{ fontFamily: "var(--font-display)" }}>
              第 {currentIndex + 1}/{totalQuestions} 题
            </Text>
          </View>
          <View className="lives-display">
            <LifePotion />
            <LifePotion />
            <LifePotion />
          </View>
        </View>

        {/* === Progress === */}
        <View className="quiz-progress">
          <View className="progress-label">
            <Text>闯关进度</Text>
            <Text>{progressPercent}%</Text>
          </View>
          <View className="progress-bar">
            <View
              className={`fill ${lastAnswerCorrect === null ? "blue" : lastAnswerCorrect ? "green" : "yellow"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        </View>

        {/* === Combo === */}
        <View className="combo-indicator">
          {combo >= 3 && (
            <Text className="combo-count">
              🔥 连击 ×{combo}
            </Text>
          )}
        </View>

        {/* === Question Card === */}
        <View className="question-card">
          <View className={`question-type-badge${isTrueFalse ? " tf" : ""}`}>
            <Text>{isChoice ? "单选题" : "判断题"}</Text>
          </View>
          <Text className="question-text">{currentQuestion.content}</Text>
          <View className="question-timer">
            <Text className="timer-icon">⏱️</Text>
            <Text>本题用时 {timer.elapsed}s</Text>
          </View>
        </View>

        {/* === Options (Choice) === */}
        {isChoice && currentQuestion.options && (
          <View className="options-list">
            {currentQuestion.options.map((opt) => {
              let btnClass = "option-btn";
              if (showExplanation) {
                if (opt.key === currentQuestion.correct_answer) {
                  btnClass += " correct";
                } else if (opt.key === selectedAnswer && opt.key !== currentQuestion.correct_answer) {
                  btnClass += " wrong";
                } else {
                  btnClass += " dimmed";
                }
              } else if (selectedAnswer === opt.key) {
                btnClass += " selected";
              }

              return (
                <View
                  key={opt.key}
                  className={btnClass}
                  onClick={() => handleSelectChoice(opt.key)}
                >
                  <View
                    className="opt-key"
                    style={
                      showExplanation && opt.key === currentQuestion.correct_answer
                        ? { background: "var(--green)", color: "white" }
                        : undefined
                    }
                  >
                    <Text>{opt.key}</Text>
                  </View>
                  <Text>{opt.text}</Text>
                  {showExplanation && opt.key === currentQuestion.correct_answer && (
                    <Text className="opt-check">✅</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* === True/False Buttons === */}
        {isTrueFalse && (
          <View className="truefalse-row">
            <View
              className={`truefalse-btn t-btn${selectedAnswer === "正确" ? " selected" : ""}`}
              onClick={() => handleSelectTF("正确")}
            >
              <Text>✅ 正确</Text>
            </View>
            <View
              className={`truefalse-btn f-btn${selectedAnswer === "错误" ? " selected" : ""}`}
              onClick={() => handleSelectTF("错误")}
            >
              <Text>❌ 错误</Text>
            </View>
          </View>
        )}

        {/* === Explanation Card (Feedback) === */}
        {showExplanation && (
          <>
            <View className={`explanation-card${lastAnswerCorrect ? "" : " wrong"}`}>
              <Text className="exp-title">
                {lastAnswerCorrect ? "✅ 回答正确！" : "❌ 回答错误"}
              </Text>
              <Text className="exp-text">
                {currentQuestion.explanation}
              </Text>
            </View>

            {/* Mascot Feedback */}
            <View className="mascot-feedback">
              <Mascot
                mood={lastAnswerCorrect ? "happy" : "encouraging"}
                size={50}
              />
              <View className="speech-bubble">
                <Text style={{ fontWeight: 700 }}>灯灯：</Text>
                <Text>
                  {lastAnswerCorrect
                    ? combo >= 3
                      ? `太厉害了！你已经连对 ${combo} 题了！`
                      : "答对了！继续保持～"
                    : "没关系，看看正确答案，下次一定能答对！"}
                </Text>
              </View>
            </View>

            {!lastAnswerCorrect && (
              <Text className="encourage-msg">
                别灰心！学习就是一个不断进步的过程 💪
              </Text>
            )}
          </>
        )}

        {/* === Quiz Complete Banner === */}
        {isCompleted && showExplanation && (
          <View className="quiz-complete-banner">
            <Text className="complete-title">🎉 闯关完成！</Text>
            <Text className="complete-score">
              {answers.filter((a) => a.is_correct).length}/{totalQuestions}
            </Text>
          </View>
        )}

        {/* === Action Row === */}
        {showExplanation ? (
          <View
            className={`comic-btn primary next-btn${isAnalyzing ? " loading" : ""}`}
            onClick={() => { if (!isAnalyzing) handleNext(); }}
          >
            <Text>{isAnalyzing ? "分析中..." : isCompleted ? "查看分析报告" : "下一题"}</Text>
          </View>
        ) : (
          <View className="action-row">
            <View className="comic-btn outline sm" onClick={handleSkip}>
              <Text>跳过</Text>
            </View>
            <View
              className={`comic-btn outline sm${currentIndex === 0 ? " disabled" : ""}`}
              onClick={() => { if (currentIndex > 0) goToPrevQuestion(); }}
            >
              <Text>上一题</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
