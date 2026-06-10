/**
 * 学习历史 — 分页闯关记录列表
 *
 * Campus Comic 校园漫画风格
 */

import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useUserStore } from "../../stores/userStore";
import { userApi } from "../../services/api";
import type { HistoryItem } from "../../types/user";
import "./index.scss";

// ── Helpers ─────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}月${day}日`;
  } catch {
    return dateStr;
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m${secs}s`;
}

function getAccuracyColor(acc: number): string {
  if (acc >= 0.8) return "var(--green)";
  if (acc >= 0.6) return "var(--blue)";
  if (acc >= 0.4) return "var(--yellow)";
  return "var(--red)";
}

// ── Page Component ──────────────────────────────────────────

export default function HistoryPage() {
  const { isLoggedIn } = useUserStore();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchHistory = useCallback(async (pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await userApi.getHistory(pageNum, 20);
      if (res.code === 0 && res.data) {
        if (pageNum === 1) {
          setItems(res.data.items);
        } else {
          setItems((prev) => [...prev, ...res.data!.items]);
        }
        setHasMore(res.data.has_more);
        setPage(pageNum);
      }
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      fetchHistory(1);
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, fetchHistory]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchHistory(page + 1);
  }, [loadingMore, hasMore, page, fetchHistory]);

  const handleLogin = useCallback(() => {
    Taro.navigateTo({ url: "/pages/login/index" });
  }, []);

  // ── Not Logged In ────────────────────────────────────────

  if (!isLoggedIn()) {
    return (
      <View className="app-phone-frame">
        <ScrollView className="app-phone-content history-page" scrollY>
          <View className="status-bar-spacer" />

          <View className="page-header">
            <View className="section-bar blue" style={{ display: "inline-block", marginRight: "8px" }} />
            <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
              学习历史
            </Text>
          </View>

          <View className="history-empty">
            <Mascot mood="encouraging" size={90} />
            <View className="speech-bubble history-empty-speech">
              <Text className="mine-speech-title">灯灯说：</Text>
              <Text>{"\n"}登录后才能查看学习历史哦～</Text>
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
        <View className="app-phone-content history-page">
          <View className="status-bar-spacer" />
          <View className="page-header">
            <View className="section-bar blue" style={{ display: "inline-block", marginRight: "8px" }} />
            <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
              学习历史
            </Text>
          </View>
          <View className="history-loading">
            <Text style={{ fontFamily: "var(--font-display)", color: "var(--gray)" }}>
              加载中...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Empty State ──────────────────────────────────────────

  if (items.length === 0) {
    return (
      <View className="app-phone-frame">
        <ScrollView className="app-phone-content history-page" scrollY>
          <View className="status-bar-spacer" />

          <View className="page-header">
            <View className="section-bar blue" style={{ display: "inline-block", marginRight: "8px" }} />
            <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
              学习历史
            </Text>
          </View>

          <View className="history-empty">
            <Mascot mood="encouraging" size={90} />
            <View className="speech-bubble history-empty-speech">
              <Text className="mine-speech-title">灯灯说：</Text>
              <Text>{"\n"}还没有学习记录哦～</Text>
              <Text>{"\n"}快去首页输入知识开始闯关吧！</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── History List ─────────────────────────────────────────

  return (
    <View className="app-phone-frame">
      <ScrollView
        className="app-phone-content history-page"
        scrollY
        onScrollToLower={handleLoadMore}
        lowerThreshold={100}
      >
        <View className="status-bar-spacer" />

        <View className="page-header">
          <View className="section-bar blue" style={{ display: "inline-block", marginRight: "8px" }} />
          <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
            学习历史
          </Text>
        </View>

        {items.map((item) => {
          const accPercent = Math.round(item.accuracy * 100);
          const accColor = getAccuracyColor(item.accuracy);

          return (
            <View key={item.session_id} className="history-item comic-card">
              <View className="history-item-top">
                <Text className="history-item-title">{item.title}</Text>
                <Text className="history-item-domain">{item.domain}</Text>
              </View>

              <View className="history-item-meta">
                <View className="history-meta-stat">
                  <Text className="history-meta-val" style={{ color: accColor }}>
                    {item.score}/{item.total}
                  </Text>
                  <Text className="history-meta-label">得分</Text>
                </View>
                <View className="history-meta-stat">
                  <Text className="history-meta-val" style={{ color: accColor }}>
                    {accPercent}%
                  </Text>
                  <Text className="history-meta-label">正确率</Text>
                </View>
                <View className="history-meta-stat">
                  <Text className="history-meta-val">{formatTime(item.time_spent)}</Text>
                  <Text className="history-meta-label">用时</Text>
                </View>
              </View>

              <View className="history-item-bottom">
                <Text className="history-item-date">{formatDate(item.created_at)}</Text>
              </View>
            </View>
          );
        })}

        {/* Load more indicator */}
        {loadingMore && (
          <View className="history-loading-more">
            <Text style={{ color: "var(--gray)", fontSize: "0.8rem" }}>加载更多...</Text>
          </View>
        )}

        {!hasMore && items.length > 0 && (
          <View className="history-loading-more">
            <Text style={{ color: "var(--gray)", fontSize: "0.78rem" }}>— 已经到底了 —</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
