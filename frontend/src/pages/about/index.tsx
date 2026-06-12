/**
 * 关于页 — 阿拉灯神丁版本信息与项目介绍
 *
 * Campus Comic 校园漫画风格
 */
import { View, Text, ScrollView } from "@tarojs/components";
import Mascot from "../../components/Mascot";
import "./index.scss";

const VERSION = "v1.4.0";
const BUILD_DATE = "2026-06-10";

export default function AboutPage() {
  return (
    <View className="app-phone-frame">
      <ScrollView className="app-phone-content about-page" scrollY>
        <View className="status-bar-spacer" />

        {/* ── Logo & Name ──────────────────────────────── */}
        <View className="about-hero">
          <View className="about-logo">
            <Text className="about-logo-text">灯</Text>
          </View>
          <Text className="about-name">阿拉灯神丁</Text>
          <Text className="about-tagline">AI 驱动的闯关学习小程序</Text>
        </View>

        {/* ── Version Info ─────────────────────────────── */}
        <View className="about-info-card comic-card">
          <View className="about-info-row">
            <Text className="about-info-label">版本</Text>
            <Text className="about-info-value">{VERSION}</Text>
          </View>
          <View className="about-info-row">
            <Text className="about-info-label">发布日期</Text>
            <Text className="about-info-value">{BUILD_DATE}</Text>
          </View>
          <View className="about-info-row">
            <Text className="about-info-label">技术栈</Text>
            <Text className="about-info-value">Taro + FastAPI + DeepSeek</Text>
          </View>
          <View className="about-info-row">
            <Text className="about-info-label">平台</Text>
            <Text className="about-info-value">微信小程序</Text>
          </View>
        </View>

        {/* ── Description ──────────────────────────────── */}
        <View className="about-desc-card comic-card">
          <Text className="about-desc-title">项目简介</Text>
          <Text className="about-desc-text">
            阿拉灯神丁是一款 AI 驱动的闯关学习工具。输入你想学习的知识点，
            AI 自动生成选择题和判断题，实时答题闯关并获得详细的学习分析报告。
            支持个人中心、学习历史、错题本、积分系统等功能，
            让学习变得像闯关游戏一样有趣！
          </Text>
        </View>

        <View className="about-desc-card comic-card">
          <Text className="about-desc-title">开发者</Text>
          <Text className="about-desc-text">
            本项目由 FAN_AI 团队开发维护。{"\n"}
            如有问题或建议，欢迎反馈。
          </Text>
        </View>

        {/* ── Mascot ───────────────────────────────────── */}
        <View className="about-footer">
          <Mascot mood="happy" size={50} />
          <View className="speech-bubble about-footer-speech">
            <Text style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>灯灯：</Text>
            <Text>感谢使用阿拉灯神丁！一起快乐学习吧～</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
