/**
 * Page ①: 首页 · 知识输入
 *
 * Faithful reproduction of PAGE 1/8 from 01-核心业务流程.html prototype.
 * All SVG icons replaced with emoji for WeChat Mini Program compatibility.
 */

import { useState, useCallback } from "react";
import { View, Text, Textarea } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useUserStore } from "../../stores/userStore";
import { userApi } from "../../services/api";
import type { HistoryItem } from "../../types/user";
import "./index.scss";

export default function IndexPage() {
  const [knowledgeInput, setKnowledgeInput] = useState("");
  const [streakDays, setStreakDays] = useState(0);
  const [recentSessions, setRecentSessions] = useState<HistoryItem[]>([]);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);

  // Fetch streak days + recent sessions on page show (including return from login)
  const fetchPageData = useCallback(() => {
    if (isLoggedIn()) {
      userApi.getStats().then((res) => {
        if (res.code === 0 && res.data) {
          setStreakDays(res.data.streak_days);
        }
      });
      userApi.getHistory(1, 3).then((res) => {
        if (res.code === 0 && res.data) {
          setRecentSessions(res.data.items || []);
        }
      });
    } else {
      // Reset data when not logged in
      setStreakDays(0);
      setRecentSessions([]);
    }
  }, []);

  // useDidShow fires on first mount AND when returning from login / other pages
  useDidShow(() => {
    fetchPageData();
  });

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    } catch {
      return dateStr;
    }
  };

  const truncateText = (text: string, maxLen = 20): string => {
    if (!text) return "";
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  };

  const getCardTitle = (item: HistoryItem): string => {
    if (item.knowledge_input) return truncateText(item.knowledge_input);
    return item.title || item.domain || "闯关记录";
  };

  const getDomainEmoji = (domain: string) => {
    const map: Record<string, string> = {
      "Python": "🐍", "编程": "💻", "数学": "📐", "物理": "⚡",
      "化学": "🧪", "历史": "📜", "英语": "🔤", "生物": "🧬",
      "地理": "🌍", "文学": "📚",
    };
    for (const [key, emoji] of Object.entries(map)) {
      if (domain.includes(key)) return emoji;
    }
    return "📖";
  };

  const handleStartQuiz = useCallback(() => {
    const input = knowledgeInput.trim();
    if (!input) {
      Taro.showToast({ title: "请输入想学的知识", icon: "none" });
      return;
    }
    Taro.navigateTo({ url: `/pages/loading/index?input=${encodeURIComponent(input)}` });
  }, [knowledgeInput]);

  const handleAttach = useCallback((type: string) => {
    Taro.showToast({ title: `${type}功能即将上线`, icon: "none" });
  }, []);

  return (
    <View className="app-phone-frame">
      <View className="app-phone-content page1">
        <View className="status-bar-spacer" />

        {/* Header */}
        <View className="page1-header">
          <View className="logo">
            <View className="logo-icon-css">
              <View className="logo-book-page" />
            </View>
            <Text>阿拉灯神丁</Text>
          </View>
          {streakDays > 0 && (
            <View className="badge hot">
              <Text>连续学习{streakDays}天</Text>
            </View>
          )}
        </View>

        {/* Mascot */}
        <View className="mascot-area">
          <View className="mascot-wrap float">
            <Mascot mood="normal" size={80} />
          </View>
          <View className="speech-bubble mascot-msg">
            <Text style={{ fontFamily: "var(--font-display)" }}>灯灯说：</Text>
            <Text>{"\n"}把想学的知识丢进来！我帮你变出超酷的题目～</Text>
          </View>
        </View>

        {/* Input */}
        <View className="input-area">
          <Textarea
            placeholder="今天想学什么？&#10;比如：Python面试高频题、中国近代史..."
            value={knowledgeInput}
            onInput={(e) => setKnowledgeInput(e.detail.value)}
            maxlength={2000}
            autoHeight
            className="knowledge-textarea"
          />
          <View className="input-actions">
            <View className="attach-btn" onClick={() => handleAttach("文档")}>
              <View className="attach-icon doc" />
              <Text>文档</Text>
            </View>
            <View className="attach-btn" onClick={() => handleAttach("链接")}>
              <View className="attach-icon link" />
              <Text>链接</Text>
            </View>
            <View className="attach-btn" onClick={() => handleAttach("拍照")}>
              <View className="attach-icon photo" />
              <Text>拍照</Text>
            </View>
            <View className="attach-btn" onClick={() => handleAttach("语音")}>
              <View className="attach-icon voice" />
              <Text>语音</Text>
            </View>
          </View>
        </View>

        {/* Generate Button */}
        <View className="comic-btn primary lg generate-btn" onClick={handleStartQuiz}>
          <Text>开始闯关</Text>
        </View>

        {/* Recent Quizzes — real data from user history */}
        {isLoggedIn() && (
          <View className="recent-quiz-section">
            <View className="section-title">
              <View className="section-bar" />
              <Text>近期闯关</Text>
            </View>
            {recentSessions.length > 0 ? (
              <View className="recent-quiz-list">
                {recentSessions.map((s) => (
                  <View
                    key={s.session_id}
                    className="recent-quiz-item"
                    onClick={() => Taro.navigateTo({ url: `/pages/sessiondetail/index?sessionId=${s.session_id}` })}
                  >
                    <View className="quiz-icon" style={{ background: s.accuracy >= 0.8 ? "#D1FAE5" : s.accuracy >= 0.6 ? "#FEF3C7" : "#FEE2E2" }}>
                      <Text style={{ fontSize: "0.85rem" }}>{getDomainEmoji(s.domain)}</Text>
                    </View>
                    <View className="quiz-info">
                      <Text className="quiz-title">{getCardTitle(s)}</Text>
                      <Text className="quiz-meta">
                        {s.score}/{s.total} 正确 · {Math.round(s.accuracy * 100)}% · {formatDate(s.created_at)}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "var(--font-display)", color: "var(--gray)", fontSize: "1.1rem" }}>→</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="recent-quiz-empty">
                <Text style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "var(--gray)" }}>
                  完成首次闯关后，这里会显示你的闯关记录～
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Login prompt for anonymous users */}
        {!isLoggedIn() && (
          <View
            className="recent-quiz-section"
            onClick={() => Taro.navigateTo({ url: "/pages/login/index" })}
          >
            <View className="section-title">
              <View className="section-bar" />
              <Text>近期闯关</Text>
            </View>
            <View className="recent-quiz-empty" style={{ cursor: "pointer" }}>
              <Text style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", color: "var(--blue)" }}>
                登录后可查看闯关记录 →
              </Text>
            </View>
          </View>
        )}

        {/* Bottom Nav */}
        <View className="nav-bar">
          {[
            { label: "首页", active: true },
            { label: "发现" },
            { label: "出题" },
            { label: "消息" },
            { label: "我的" },
          ].map((item) => (
            <View
              key={item.label}
              className={`nav-item${item.active ? " active" : ""}`}
              onClick={() => {
                if (item.label === "我的") {
                  const isLoggedIn = useUserStore.getState().token;
                  if (isLoggedIn) {
                    Taro.navigateTo({ url: "/pages/mine/index" });
                  } else {
                    Taro.navigateTo({ url: "/pages/login/index" });
                  }
                } else if (!item.active) {
                  Taro.showToast({ title: `${item.label}功能即将上线`, icon: "none" });
                }
              }}
            >
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
