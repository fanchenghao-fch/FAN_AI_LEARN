/**
 * 个人中心 — 用户资料、统计数据、导航菜单
 *
 * Campus Comic 校园漫画风格
 */

import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useUserStore } from "../../stores/userStore";
import { userApi } from "../../services/api";
import type { UserStats } from "../../types/user";
import "./index.scss";

// ── Helpers ─────────────────────────────────────────────────

function getLevelColor(level: number): string {
  const colors: Record<number, string> = {
    1: "var(--green)",
    2: "var(--blue)",
    3: "var(--yellow)",
    4: "var(--orange)",
    5: "var(--red)",
  };
  return colors[level] || "var(--blue)";
}

// ── Page Component ──────────────────────────────────────────

export default function MinePage() {
  const { user, token, isLoggedIn, logout } = useUserStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await userApi.getStats();
      if (res.code === 0 && res.data) {
        setStats(res.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Redirect to login if not authenticated
  const handleNavigateToLogin = useCallback(() => {
    Taro.navigateTo({ url: "/pages/login/index" });
  }, []);

  const handleNavigateToHistory = useCallback(() => {
    Taro.navigateTo({ url: "/pages/history/index" });
  }, []);

  const handleNavigateToWrongBook = useCallback(() => {
    Taro.navigateTo({ url: "/pages/wrongbook/index" });
  }, []);

  const handleLogout = useCallback(() => {
    Taro.showModal({
      title: "确认退出",
      content: "退出后需要重新登录才能查看学习记录哦",
      success: (res) => {
        if (res.confirm) {
          logout();
          Taro.showToast({ title: "已退出登录", icon: "none" });
        }
      },
    });
  }, [logout]);

  // ── Not Logged In State ──────────────────────────────────

  if (!isLoggedIn() || !user) {
    return (
      <View className="app-phone-frame">
        <ScrollView className="app-phone-content mine-page" scrollY>
          <View className="status-bar-spacer" />

          <View className="mine-mascot-area">
            <View className="mine-mascot-wrap float">
              <Mascot mood="normal" size={80} />
            </View>
            <View className="speech-bubble mine-speech">
              <Text className="mine-speech-title">灯灯说：</Text>
              <Text>{"\n"}登录后才能查看个人中心哦～</Text>
              <Text>{"\n"}快去登录，开启学习之旅吧！</Text>
            </View>
          </View>

          <View
            className="comic-btn primary lg mine-login-btn"
            onClick={handleNavigateToLogin}
          >
            <Text>去登录</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Stats Display ────────────────────────────────────────

  const displayStats = stats || {
    total_sessions: 0,
    accuracy: 0,
    streak_days: 0,
    coins: user.coins,
    experience: user.experience,
    level: user.level,
    level_title: user.level_title,
    exp_to_next: 100,
    exp_percent: 0,
  };

  const levelColor = getLevelColor(displayStats.level);

  return (
    <View className="app-phone-frame">
      <ScrollView className="app-phone-content mine-page" scrollY>
        <View className="status-bar-spacer" />

        {/* ── User Info Card ──────────────────────────── */}
        <View className="mine-user-card comic-card">
          <View className="mine-user-top">
            {/* Avatar — CSS circle */}
            <View className="mine-avatar">
              <View className="mine-avatar-inner">
                <Text className="mine-avatar-text">
                  {user.nickname.charAt(0)}
                </Text>
              </View>
            </View>

            <View className="mine-user-info">
              <Text className="mine-nickname">{user.nickname}</Text>
              <View className="mine-level-badge" style={{ background: levelColor }}>
                <Text className="mine-level-text">
                  Lv.{displayStats.level} {displayStats.level_title}
                </Text>
              </View>
            </View>
          </View>

          {/* Exp progress */}
          <View className="mine-exp-section">
            <View className="mine-exp-label-row">
              <Text className="mine-exp-label">经验值</Text>
              <Text className="mine-exp-val">
                {displayStats.experience} / {displayStats.experience + displayStats.exp_to_next}
              </Text>
            </View>
            <View className="progress-bar mine-exp-bar">
              <View
                className="fill blue"
                style={{ width: `${displayStats.exp_percent}%` }}
              />
            </View>
            {displayStats.level < 5 && (
              <Text className="mine-exp-hint">
                还需 {displayStats.exp_to_next} 经验升级
              </Text>
            )}
          </View>
        </View>

        {/* ── Coins Card ──────────────────────────────── */}
        <View className="mine-coins-card comic-card">
          <View className="mine-coins-row">
            <View className="mine-coin-icon">
              <View className="coin-circle" />
            </View>
            <View className="mine-coins-info">
              <Text className="mine-coins-num">{displayStats.coins}</Text>
              <Text className="mine-coins-label">金币</Text>
            </View>
          </View>
        </View>

        {/* ── Stats Row ───────────────────────────────── */}
        <View className="mine-stats-row">
          <View className="mine-stat-item">
            <Text className="mine-stat-num">{displayStats.total_sessions}</Text>
            <Text className="mine-stat-label">累计闯关</Text>
          </View>
          <View className="mine-stat-item">
            <Text className="mine-stat-num">
              {Math.round(displayStats.accuracy * 100)}%
            </Text>
            <Text className="mine-stat-label">正确率</Text>
          </View>
          <View className="mine-stat-item">
            <Text className="mine-stat-num">{displayStats.streak_days}</Text>
            <Text className="mine-stat-label">连续打卡</Text>
          </View>
        </View>

        {/* ── Menu ────────────────────────────────────── */}
        <View className="mine-menu">
          <View
            className="mine-menu-item comic-card"
            onClick={handleNavigateToHistory}
          >
            <View className="section-bar blue" />
            <Text className="mine-menu-text">学习历史</Text>
            <Text className="mine-menu-arrow">→</Text>
          </View>

          <View
            className="mine-menu-item comic-card"
            onClick={handleNavigateToWrongBook}
          >
            <View className="section-bar red" />
            <Text className="mine-menu-text">错题本</Text>
            <Text className="mine-menu-arrow">→</Text>
          </View>

          <View className="mine-menu-item comic-card dashed">
            <View className="section-bar yellow" />
            <Text className="mine-menu-text">关于阿拉灯神丁</Text>
            <Text className="mine-menu-arrow">→</Text>
          </View>
        </View>

        {/* ── Logout ──────────────────────────────────── */}
        <View className="comic-btn outline mine-logout-btn" onClick={handleLogout}>
          <Text>退出登录</Text>
        </View>

        {/* ── Bottom Mascot ───────────────────────────── */}
        <View className="mine-footer-mascot">
          <Mascot
            mood={displayStats.streak_days >= 7 ? "happy" : "encouraging"}
            size={60}
          />
          <View className="speech-bubble mine-footer-speech">
            <Text className="mine-speech-title">灯灯：</Text>
            <Text>
              {displayStats.streak_days >= 7
                ? `已经连续学习 ${displayStats.streak_days} 天了！太棒了！`
                : displayStats.total_sessions === 0
                  ? "快去闯关赚金币吧！"
                  : "坚持学习，每天进步一点点～"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
