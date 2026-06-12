/**
 * 闯关详情页 — 查看某次闯关的完整总结
 *
 * 展示：分数、正确率、用时、最高连击、金币、错题列表
 */
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { userApi } from "../../services/api";
import type { SessionDetail } from "../../types/user";
import "./index.scss";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

export default function SessionDetailPage() {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useLoad((options) => {
    const sessionId = options?.sessionId || "";
    if (!sessionId) {
      setError("缺少闯关记录ID");
      setLoading(false);
      return;
    }
    fetchSession(sessionId);
  });

  const fetchSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await userApi.getSessionDetail(sessionId);
      if (res.code === 0 && res.data) {
        setSession(res.data);
      } else {
        setError(res.message || "加载失败");
      }
    } catch {
      setError("网络请求失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    Taro.navigateBack();
  }, []);

  const handleWrongClick = useCallback((wrongId: string) => {
    Taro.navigateTo({ url: `/pages/wrongdetail/index?id=${wrongId}` });
  }, []);

  // ── Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <View className="app-phone-frame">
        <View className="app-phone-content sessiondetail-page">
          <View className="status-bar-spacer" />
          <View className="sessiondetail-status">
            <Text style={{ fontFamily: "var(--font-display)", color: "var(--gray)" }}>
              加载中...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────

  if (error || !session) {
    return (
      <View className="app-phone-frame">
        <View className="app-phone-content sessiondetail-page">
          <View className="status-bar-spacer" />
          <View className="sessiondetail-status">
            <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
              {error || "闯关记录不存在"}
            </Text>
            <View className="comic-btn outline sm" onClick={handleBack}>
              <Text>返回</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const accuracyPercent = Math.round(session.accuracy * 100);

  return (
    <View className="app-phone-frame">
      <ScrollView className="app-phone-content sessiondetail-page" scrollY>
        <View className="status-bar-spacer" />

        {/* ── Header ──────────────────────────────────── */}
        <View className="page-header">
          <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700 }}>
            {session.title || session.domain || "闯关详情"}
          </Text>
          <Text style={{ display: "block", fontSize: "0.75rem", color: "var(--gray)", marginTop: "4px" }}>
            {session.domain} · {formatDate(session.created_at)}
          </Text>
        </View>

        {/* ── Score Hero ─────────────────────────────── */}
        <View className="sessiondetail-hero">
          <Text className="sessiondetail-score" style={{ color: accuracyPercent >= 80 ? "var(--green)" : accuracyPercent >= 60 ? "var(--yellow)" : "var(--red)" }}>
            {session.score}/{session.total}
          </Text>
          <Text className="sessiondetail-accuracy">
            正确率 {accuracyPercent}%
          </Text>
        </View>

        {/* ── Stats Row ──────────────────────────────── */}
        <View className="sessiondetail-stats">
          <View className="sessiondetail-stat-item">
            <Text className="sessiondetail-stat-val">{formatTime(session.time_spent)}</Text>
            <Text className="sessiondetail-stat-label">用时</Text>
          </View>
          <View className="sessiondetail-stat-item">
            <Text className="sessiondetail-stat-val">×{session.combo_max}</Text>
            <Text className="sessiondetail-stat-label">最高连击</Text>
          </View>
          <View className="sessiondetail-stat-item">
            <Text className="sessiondetail-stat-val">+{session.coins_earned}</Text>
            <Text className="sessiondetail-stat-label">金币</Text>
          </View>
        </View>

        {/* ── Wrong Questions ────────────────────────── */}
        <View className="sessiondetail-wq-section">
          <View className="sessiondetail-wq-header">
            <View className="section-bar red" />
            <Text className="sessiondetail-wq-title">
              错题回顾 ({session.wrong_questions.length} 题)
            </Text>
          </View>

          {session.wrong_questions.length === 0 ? (
            <View className="sessiondetail-all-correct">
              <Text>🎉 全部答对，太厉害了！</Text>
            </View>
          ) : (
            session.wrong_questions.map((wq, i) => (
              <View
                key={wq.id}
                className="sessiondetail-wq-item"
                onClick={() => handleWrongClick(wq.id)}
              >
                <Text className="sessiondetail-wq-content">
                  {i + 1}. {wq.content}
                </Text>
                <View className="sessiondetail-wq-answers">
                  <Text>
                    你的答案：<Text className="sessiondetail-wq-user">{wq.user_answer}</Text>
                  </Text>
                  <Text>
                    正确：<Text className="sessiondetail-wq-correct">{wq.correct_answer}</Text>
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Back ───────────────────────────────────── */}
        <View className="comic-btn outline sessiondetail-back-btn" onClick={handleBack}>
          <Text>返回首页</Text>
        </View>

        <View style={{ height: "16px" }} />
      </ScrollView>
    </View>
  );
}
