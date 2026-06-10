/**
 * 错题详情 — 单题完整展示 + 答案对比 + 重新作答 + 标记已掌握
 *
 * Campus Comic 校园漫画风格
 */

import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useUserStore } from "../../stores/userStore";
import { userApi } from "../../services/api";
import "./index.scss";

// ── Types ────────────────────────────────────────────────────

interface Option {
  key: string;
  text: string;
}

interface WrongQuestionDetail {
  id: string;
  question_id: string;
  content: string;
  user_answer: string;
  correct_answer: string;
  explanation: string;
  domain: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  session_title: string;
  session_id: string;
  options?: Option[] | null;
}

// ── Helpers ─────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${month}月${day}日 ${hour}:${min}`;
  } catch {
    return dateStr;
  }
}

// ── Page Component ──────────────────────────────────────────

export default function WrongDetailPage() {
  const router = useRouter();
  const { isLoggedIn } = useUserStore();
  const [detail, setDetail] = useState<WrongQuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Re-answer state ──────────────────────────────────
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<"correct" | "wrong" | null>(null);

  // Get ID from router params
  const wrongId = router.params.id || "";

  const fetchDetail = useCallback(async () => {
    if (!wrongId) {
      setError("缺少错题ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await userApi.getWrongQuestionDetail(wrongId);
      if (res.code === 0 && res.data) {
        setDetail(res.data as unknown as WrongQuestionDetail);
      } else if (res.code === 401) {
        setError("请先登录");
      } else if (res.code === 404) {
        setError("错题不存在");
      } else {
        setError(res.message || "加载失败");
      }
    } catch {
      setError("网络请求失败");
    } finally {
      setLoading(false);
    }
  }, [wrongId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ── Re-answer handler ────────────────────────────────

  const handleOptionSelect = useCallback(
    async (optionKey: string) => {
      if (!detail || detail.resolved || retrying) return;

      setSelectedOption(optionKey);
      setRetrying(true);
      setRetryResult(null);

      try {
        const res = await userApi.retryWrongQuestion(detail.id, optionKey);
        if (res.code === 0 && res.data) {
          const { is_correct, resolved, coins_earned } = res.data;

          if (is_correct) {
            setRetryResult("correct");
            setDetail({
              ...detail,
              resolved: true,
              resolved_at: new Date().toISOString(),
            });
            Taro.showToast({
              title: coins_earned > 0 ? `回答正确！+${coins_earned} 金币` : "回答正确！",
              icon: "success",
            });
          } else {
            setRetryResult("wrong");
            Taro.showToast({ title: "继续加油！", icon: "none" });
          }
        } else {
          Taro.showToast({ title: res.message || "操作失败", icon: "none" });
        }
      } catch {
        Taro.showToast({ title: "网络请求失败", icon: "none" });
      } finally {
        setRetrying(false);
      }
    },
    [detail, retrying],
  );

  // ── Resolve handler (fallback for questions without options) ──

  const handleResolve = useCallback(async () => {
    if (!detail || detail.resolved) return;
    setResolving(true);
    try {
      const res = await userApi.resolveWrongQuestion(detail.id);
      if (res.code === 0) {
        setDetail({ ...detail, resolved: true, resolved_at: new Date().toISOString() });
        Taro.showToast({ title: "已标记为已掌握！", icon: "success" });
      } else {
        Taro.showToast({ title: res.message || "操作失败", icon: "none" });
      }
    } catch {
      Taro.showToast({ title: "网络请求失败", icon: "none" });
    } finally {
      setResolving(false);
    }
  }, [detail]);

  const handleGoBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const handleLogin = useCallback(() => {
    Taro.navigateTo({ url: "/pages/login/index" });
  }, []);

  // ── Not Logged In ────────────────────────────────────────

  if (!isLoggedIn()) {
    return (
      <View className="app-phone-frame">
        <ScrollView className="app-phone-content wrongdetail-page" scrollY>
          <View className="status-bar-spacer" />

          <View className="wrongdetail-empty">
            <Mascot mood="encouraging" size={80} />
            <View className="speech-bubble wrongdetail-empty-speech">
              <Text className="mine-speech-title">灯灯说：</Text>
              <Text>{"\n"}登录后才能查看错题详情哦～</Text>
            </View>
          </View>

          <View
            className="comic-btn primary lg"
            style={{ display: "flex", width: "100%", maxWidth: "100%", boxSizing: "border-box", marginTop: "16px" }}
            onClick={handleLogin}
          >
            <Text>去登录</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Loading ──────────────────────────────────────────────

  if (loading) {
    return (
      <View className="app-phone-frame">
        <View className="app-phone-content wrongdetail-page">
          <View className="status-bar-spacer" />
          <View className="wrongdetail-loading">
            <Text style={{ fontFamily: "var(--font-display)", color: "var(--gray)" }}>
              加载中...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────

  if (error || !detail) {
    return (
      <View className="app-phone-frame">
        <View className="app-phone-content wrongdetail-page">
          <View className="status-bar-spacer" />
          <View className="wrongdetail-empty">
            <Mascot mood="sad" size={80} />
            <View className="speech-bubble wrongdetail-empty-speech">
              <Text className="mine-speech-title">灯灯说：</Text>
              <Text>{"\n"}{error || "加载失败"}</Text>
            </View>
          </View>
          <View
            className="comic-btn outline"
            style={{ display: "flex", width: "100%", maxWidth: "100%", boxSizing: "border-box", marginTop: "16px" }}
            onClick={handleGoBack}
          >
            <Text>返回</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Derived state ────────────────────────────────────────

  const hasOptions = detail.options && detail.options.length > 0;
  const showReAnswer = hasOptions && !detail.resolved;

  // ── Detail ────────────────────────────────────────────────

  return (
    <View className="app-phone-frame">
      <ScrollView className="app-phone-content wrongdetail-page" scrollY>
        <View className="status-bar-spacer" />

        {/* ── Question ──────────────────────────────── */}
        <View className="wrongdetail-question-card comic-card">
          <View className="wrongdetail-domain-badge">
            <Text>{detail.domain || "综合"}</Text>
          </View>
          <Text className="wrongdetail-question-text">
            题目：{detail.content}
          </Text>
        </View>

        {/* ── Answer Comparison ─────────────────────── */}
        <View className="wrongdetail-answers">
          {/* User answer — wrong */}
          <View className="wrongdetail-answer-card wrong">
            <View className="wrongdetail-answer-header">
              <View className="wrongdetail-answer-icon wrong-icon">
                <Text className="wrongdetail-icon-text">✕</Text>
              </View>
              <Text className="wrongdetail-answer-label">你的答案</Text>
            </View>
            <Text className="wrongdetail-answer-text">
              {detail.user_answer}
            </Text>
          </View>

          {/* Correct answer */}
          <View className="wrongdetail-answer-card correct">
            <View className="wrongdetail-answer-header">
              <View className="wrongdetail-answer-icon correct-icon">
                <Text className="wrongdetail-icon-text" style={{ color: "white" }}>✓</Text>
              </View>
              <Text className="wrongdetail-answer-label">正确答案</Text>
            </View>
            <Text className="wrongdetail-answer-text correct-text">
              {detail.correct_answer}
            </Text>
          </View>
        </View>

        {/* ── Explanation ───────────────────────────── */}
        <View className="wrongdetail-explanation comic-card dashed">
          <View className="wrongdetail-exp-header">
            <View className="section-bar blue" />
            <Text style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
              题目解析
            </Text>
          </View>
          <Text className="wrongdetail-exp-text">{detail.explanation}</Text>
        </View>

        {/* ── Re-answer Options ─────────────────────── */}
        {showReAnswer && (
          <View className="wrongdetail-retry-section">
            <View className="wrongdetail-retry-header">
              <View className="section-bar yellow" />
              <Text style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                重新作答
              </Text>
            </View>
            <Text className="wrongdetail-retry-hint">
              选择你认为正确的答案：
            </Text>
            <View className="wrongdetail-options">
              {detail.options!.map((opt) => {
                let optClass = "wrongdetail-option-btn";
                if (selectedOption === opt.key) {
                  if (retryResult === "correct") {
                    optClass += " correct";
                  } else if (retryResult === "wrong") {
                    optClass += " wrong";
                  } else {
                    optClass += " selected";
                  }
                }
                // Highlight the correct answer after a wrong retry
                if (
                  retryResult === "wrong" &&
                  opt.key === detail.correct_answer
                ) {
                  optClass += " hint-correct";
                }

                return (
                  <View
                    key={opt.key}
                    className={optClass}
                    onClick={() => handleOptionSelect(opt.key)}
                  >
                    <View className="wrongdetail-option-key">
                      <Text>{opt.key}</Text>
                    </View>
                    <Text className="wrongdetail-option-text">{opt.text}</Text>
                    {retryResult === "correct" && opt.key === selectedOption && (
                      <View className="wrongdetail-option-check">✓</View>
                    )}
                  </View>
                );
              })}
            </View>
            {retrying && (
              <Text className="wrongdetail-retry-loading">判断中...</Text>
            )}
          </View>
        )}

        {/* ── Session Info ──────────────────────────── */}
        <View className="wrongdetail-meta">
          <Text className="wrongdetail-meta-text">
            所属闯关：{detail.session_title || "未知"}
          </Text>
          <Text className="wrongdetail-meta-text">
            错题时间：{formatDate(detail.created_at)}
          </Text>
        </View>

        {/* ── Action ────────────────────────────────── */}
        {detail.resolved ? (
          <View className="wrongdetail-resolved-banner">
            <View className="wrongdetail-resolved-icon">
              <Text style={{ color: "white", fontWeight: 900 }}>✓</Text>
            </View>
            <Text className="wrongdetail-resolved-text">
              已掌握
              {detail.resolved_at && ` · ${formatDate(detail.resolved_at)}`}
            </Text>
          </View>
        ) : !hasOptions ? (
          /* Fallback: "mark as resolved" for questions without options */
          <View
            className={`comic-btn green lg wrongdetail-resolve-btn${
              resolving ? " loading" : ""
            }`}
            onClick={resolving ? undefined : handleResolve}
          >
            <Text>{resolving ? "标记中..." : "标记为已掌握"}</Text>
          </View>
        ) : null}

        {/* ── Back button ──────────────────────────── */}
        <View
          className="comic-btn outline wrongdetail-back-btn"
          onClick={handleGoBack}
        >
          <Text>返回错题本</Text>
        </View>

        {/* ── Mascot ────────────────────────────────── */}
        <View className="wrongdetail-mascot">
          <Mascot
            mood={
              detail.resolved
                ? "happy"
                : retryResult === "wrong"
                  ? "encouraging"
                  : "normal"
            }
            size={55}
          />
          <View className="speech-bubble wrongdetail-mascot-speech">
            <Text className="mine-speech-title">灯灯：</Text>
            <Text>
              {detail.resolved
                ? "又消灭一道错题！真棒！"
                : retryResult === "wrong"
                  ? "别灰心，再仔细看看解析～"
                  : showReAnswer
                    ? "重新选一个答案试试吧！"
                    : "搞懂这道题，下次一定答对！"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
