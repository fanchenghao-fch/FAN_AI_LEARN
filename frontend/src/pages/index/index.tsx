/**
 * Page ①: 首页 · 知识输入
 *
 * Faithful reproduction of PAGE 1/8 from 01-核心业务流程.html prototype.
 */

import { useState, useCallback } from "react";
import { View, Text, Textarea, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import "./index.scss";

export default function IndexPage() {
  const [knowledgeInput, setKnowledgeInput] = useState("");

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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-4px" }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <Text>AI闯关学</Text>
          </View>
          <View className="badge hot">
            <Text>连续学习3天</Text>
          </View>
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
            <Button className="attach-btn" onClick={() => handleAttach("文档")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <Text>文档</Text>
            </Button>
            <Button className="attach-btn" onClick={() => handleAttach("链接")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <Text>链接</Text>
            </Button>
            <Button className="attach-btn" onClick={() => handleAttach("拍照")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <Text>拍照</Text>
            </Button>
            <Button className="attach-btn" onClick={() => handleAttach("语音")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <Text>语音</Text>
            </Button>
          </View>
        </View>

        {/* Generate Button */}
        <Button className="comic-btn primary lg generate-btn" onClick={handleStartQuiz}>
          <Text>开始闯关</Text>
        </Button>

        {/* Hot Quizzes */}
        <View className="hot-quiz-section">
          <View className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-3px" }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <Text>热门闯关</Text>
          </View>
          <View className="hot-quiz-list">
            {["Python面试高频题50道", "中国近代史十大事件", "高考物理必考公式"].map((title, i) => (
              <View key={i} className="hot-quiz-item" onClick={() => setKnowledgeInput(title)}>
                <View className="quiz-icon" style={{ background: i === 0 ? "#FEF3C7" : i === 1 ? "#DBEAFE" : "#D1FAE5", fontWeight: 900 }}>
                  <Text>{["Py", "史", "物"][i]}</Text>
                </View>
                <View className="quiz-info">
                  <Text className="quiz-title">{title}</Text>
                  <Text className="quiz-meta">{["1280人已闯关 · 中等难度", "890人已闯关 · 简单难度", "新上线 · 困难难度"][i]}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Nav */}
        <View className="nav-bar">
          {[
            { label: "首页", icon: "home", active: true },
            { label: "发现", icon: "search" },
            { label: "出题", icon: "plus" },
            { label: "消息", icon: "message" },
            { label: "我的", icon: "user" },
          ].map((item) => (
            <View key={item.label} className={`nav-item${item.active ? " active" : ""}`}>
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
