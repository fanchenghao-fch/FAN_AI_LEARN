/**
 * Page ①: 首页 · 知识输入
 *
 * Faithful reproduction of PAGE 1/8 from 01-核心业务流程.html prototype.
 * All SVG icons replaced with emoji for WeChat Mini Program compatibility.
 */

import { useState, useCallback } from "react";
import { View, Text, Textarea } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useUserStore } from "../../stores/userStore";
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
            <View className="logo-icon-css">
              <View className="logo-book-page" />
            </View>
            <Text>阿拉灯神丁</Text>
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

        {/* Hot Quizzes */}
        <View className="hot-quiz-section">
          <View className="section-title">
            <View className="section-bar" />
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
