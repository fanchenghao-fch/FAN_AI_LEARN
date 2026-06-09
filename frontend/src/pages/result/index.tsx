/**
 * Page ⑦⑧: 通关结果 + 知识总结 + 错题回顾
 *
 * Faithful reproduction of PAGES 7/8 from 01-核心业务流程.html prototype.
 * Shows scorecard, mastery radar, AI knowledge summary, and wrong question review.
 *
 * Score ring SVG replaced with CSS implementation for WeChat Mini Program compatibility.
 */

import { useCallback } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useQuizStore } from "../../stores/quizStore";
import type { QuizResult, WrongQuestionDetail } from "../../types/quiz";
import "./index.scss";

// ── Helpers ─────────────────────────────────────────────────

function getGradeInfo(accuracy: number): { gradeKey: string; label: string; color: string } {
  if (accuracy >= 0.9) return { gradeKey: "S", label: "学霸级！", color: "var(--yellow)" };
  if (accuracy >= 0.8) return { gradeKey: "A", label: "非常棒！", color: "var(--green)" };
  if (accuracy >= 0.6) return { gradeKey: "B", label: "表现不错！", color: "var(--blue)" };
  if (accuracy >= 0.4) return { gradeKey: "C", label: "继续加油！", color: "var(--orange)" };
  return { gradeKey: "D", label: "需要多练练~", color: "var(--purple)" };
}

function getMasteryColor(score: number): string {
  if (score >= 0.8) return "var(--green)";
  if (score >= 0.6) return "var(--blue)";
  if (score >= 0.4) return "var(--yellow)";
  return "var(--red)";
}

// ── Page Component ──────────────────────────────────────────

export default function ResultPage() {
  const result = useQuizStore((s) => s.result);
  const session = useQuizStore((s) => s.session);
  const resetSession = useQuizStore((s) => s.resetSession);

  // Build local result if AI analysis hasn't completed
  const displayResult: QuizResult | null = result || (() => {
    if (!session.quiz_id) return null;
    const correct = session.answers.filter((a) => a.is_correct).length;
    const total = session.questions.length;
    const wrongList: WrongQuestionDetail[] = session.answers
      .filter((a) => !a.is_correct)
      .map((a) => {
        const q = session.questions.find((q) => q.id === a.question_id);
        return {
          question_id: a.question_id,
          content: q?.content || "",
          user_answer: a.user_answer,
          correct_answer: q?.correct_answer || "",
          explanation: q?.explanation || "",
        };
      });

    return {
      quiz_id: session.quiz_id,
      title: session.title,
      score: correct,
      total_questions: total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) / 100 : 0,
      total_time: 0,
      knowledge_summary: [],
      wrong_questions: wrongList,
      mastery_radar: {},
      study_suggestion: "",
    };
  })();

  const handleRetry = useCallback(() => {
    resetSession();
    Taro.redirectTo({ url: "/pages/index/index" });
  }, [resetSession]);

  const handleShare = useCallback(() => {
    Taro.showToast({ title: "分享功能即将上线", icon: "none" });
  }, []);

  if (!displayResult) {
    return (
      <View className="app-phone-frame">
        <View className="app-phone-content">
          <Text>加载结果中...</Text>
        </View>
      </View>
    );
  }

  const { gradeKey, label, color } = getGradeInfo(displayResult.accuracy);
  const masteryEntries = Object.entries(displayResult.mastery_radar || {});
  const accuracyPercent = Math.round(displayResult.accuracy * 100);

  return (
    <View className="app-phone-frame">
      <ScrollView className="app-phone-content result-page" scrollY>
        {/* === Result Hero === */}
        <View className="result-hero">
          <View className="result-grade">
            <View className="grade-badge" style={{ background: color }}>
              <Text className="grade-key">{gradeKey}</Text>
            </View>
            <Text style={{ color }}>{label}</Text>
          </View>

          {/* Score Ring — CSS only */}
          <View className="result-score-ring">
            <View
              className="score-ring-css"
              style={{ borderColor: color }}
            >
              <View className="score-ring-inner">
                <Text className="score-text" style={{ color }}>
                  {displayResult.score}/{displayResult.total_questions}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats Row */}
          <View className="result-stats">
            <View className="result-stat">
              <Text className="stat-val">{accuracyPercent}%</Text>
              <Text className="stat-label">正确率</Text>
            </View>
            <View className="result-stat">
              <Text className="stat-val">{displayResult.total_time}s</Text>
              <Text className="stat-label">用时</Text>
            </View>
            <View className="result-stat">
              <Text className="stat-val">#{session.max_combo}</Text>
              <Text className="stat-label">最高连击</Text>
            </View>
          </View>

          {/* Mascot */}
          <View className="result-mascot">
            <Mascot
              mood={displayResult.accuracy >= 0.6 ? "happy" : "encouraging"}
              size={70}
            />
          </View>
        </View>

        {/* === Actions === */}
        <View className="result-actions">
          <View className="comic-btn primary" onClick={handleRetry}>
            <Text>再来一局</Text>
          </View>
          <View className="comic-btn outline" onClick={handleShare}>
            <Text>分享成绩</Text>
          </View>
        </View>

        {/* === Divider === */}
        <View className="section-divider" />

        {/* === Mastery Radar === */}
        {masteryEntries.length > 0 && (
          <View className="mastery-section">
            <View className="summary-header">
              <View className="section-bar blue" />
              <Text>掌握度分析</Text>
            </View>
            {masteryEntries.map(([dim, score]) => (
              <View key={dim} className="mastery-item">
                <Text className="mastery-label">{dim}</Text>
                <View className="mastery-bar-wrap">
                  <View
                    className="mastery-bar-fill"
                    style={{
                      width: `${Math.round(score * 100)}%`,
                      background: getMasteryColor(score),
                    }}
                  />
                </View>
                <Text className="mastery-val">{Math.round(score * 100)}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* === Knowledge Summary === */}
        {displayResult.knowledge_summary.length > 0 && (
          <View>
            <View className="summary-header">
              <View className="section-bar yellow" />
              <Text>知识要点总结</Text>
            </View>
            <View className="knowledge-points">
              {displayResult.knowledge_summary.map((point, i) => (
                <View key={i} className="knowledge-point">
                  <View className="kp-num">
                    <Text>{i + 1}</Text>
                  </View>
                  <Text className="kp-text">{point}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* === Study Suggestion === */}
        {displayResult.study_suggestion && (
          <View className="study-suggestion-card">
            <View className="sug-icon-css"><View className="target-dot" /></View>
            <Text className="sug-text">{displayResult.study_suggestion}</Text>
          </View>
        )}

        {/* === Wrong Question Review === */}
        <View className="wrong-review-section">
          <View className="summary-header">
            <View className="section-bar red" />
            <Text>错题回顾</Text>
          </View>

          {displayResult.wrong_questions.length === 0 ? (
            <View className="empty-wrong">
              <View className="empty-star" />
              <Text className="empty-text">全部答对！你太厉害了！</Text>
            </View>
          ) : (
            displayResult.wrong_questions.map((wq, i) => (
              <View key={i} className="wrong-review-item">
                <Text className="wrong-q">
                  {i + 1}. {wq.content}
                </Text>
                <Text className="wrong-answers">
                  你的答案：<Text className="user-wrong">{wq.user_answer}</Text>
                  {" | "}
                  正确答案：<Text className="correct-ans">{wq.correct_answer}</Text>
                </Text>
                <Text style={{ fontSize: "0.78rem", color: "var(--dark)", marginTop: "4px" }}>
                  {wq.explanation}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* === Bottom Retry === */}
        <View
          className="comic-btn primary"
          style={{ display: "flex", width: "100%", maxWidth: "100%", boxSizing: "border-box", marginBottom: "16px" }}
          onClick={handleRetry}
        >
          <Text>再来一局</Text>
        </View>
      </ScrollView>
    </View>
  );
}
