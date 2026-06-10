/**
 * 错题本 — 按领域分组的错题列表，支持全部/待复习/已掌握筛选
 *
 * Campus Comic 校园漫画风格
 */

import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useUserStore } from "../../stores/userStore";
import { userApi } from "../../services/api";
import type { WrongQuestionsByDomain } from "../../types/user";
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

function truncateText(text: string, maxLen = 40): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

// ── Page Component ──────────────────────────────────────────

export default function WrongBookPage() {
  const { isLoggedIn } = useUserStore();
  const [groups, setGroups] = useState<WrongQuestionsByDomain[]>([]);
  const [total, setTotal] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [filter, setFilter] = useState<number | undefined>(undefined); // undefined=全部, 0=待复习, 1=已掌握
  const [loading, setLoading] = useState(true);

  const fetchWrongQuestions = useCallback(async (resolved?: number) => {
    setLoading(true);
    try {
      const res = await userApi.getWrongQuestions(resolved);
      if (res.code === 0 && res.data) {
        // The backend returns { groups, total, resolved_count, unresolved_count }
        const data = res.data as unknown as {
          groups: WrongQuestionsByDomain[];
          total: number;
          resolved_count: number;
          unresolved_count: number;
        };
        setGroups(data.groups || []);
        setTotal(data.total || 0);
        setResolvedCount(data.resolved_count || 0);
        setUnresolvedCount(data.unresolved_count || 0);
      }
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      fetchWrongQuestions(filter);
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, filter, fetchWrongQuestions]);

  const handleFilterChange = useCallback((newFilter: number | undefined) => {
    setFilter(newFilter);
  }, []);

  const handleQuestionClick = useCallback((questionId: string) => {
    Taro.navigateTo({ url: `/pages/wrongdetail/index?id=${questionId}` });
  }, []);

  const handleLogin = useCallback(() => {
    Taro.navigateTo({ url: "/pages/login/index" });
  }, []);

  // ── Not Logged In ────────────────────────────────────────

  if (!isLoggedIn()) {
    return (
      <View className="app-phone-frame">
        <ScrollView className="app-phone-content wrongbook-page" scrollY>
          <View className="status-bar-spacer" />

          <View className="page-header">
            <View className="section-bar red" style={{ display: "inline-block", marginRight: "8px" }} />
            <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
              错题本
            </Text>
          </View>

          <View className="wrongbook-empty">
            <Mascot mood="normal" size={90} />
            <View className="speech-bubble wrongbook-empty-speech">
              <Text className="mine-speech-title">灯灯说：</Text>
              <Text>{"\n"}登录后才能查看错题本哦～</Text>
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
        <View className="app-phone-content wrongbook-page">
          <View className="status-bar-spacer" />
          <View className="page-header">
            <View className="section-bar red" style={{ display: "inline-block", marginRight: "8px" }} />
            <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
              错题本
            </Text>
          </View>
          <View className="wrongbook-loading">
            <Text style={{ fontFamily: "var(--font-display)", color: "var(--gray)" }}>
              加载中...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Empty State ──────────────────────────────────────────

  if (total === 0) {
    return (
      <View className="app-phone-frame">
        <ScrollView className="app-phone-content wrongbook-page" scrollY>
          <View className="status-bar-spacer" />

          <View className="page-header">
            <View className="section-bar red" style={{ display: "inline-block", marginRight: "8px" }} />
            <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
              错题本
            </Text>
          </View>

          <View className="wrongbook-empty">
            <Mascot mood="happy" size={90} />
            <View className="speech-bubble wrongbook-empty-speech">
              <Text className="mine-speech-title">灯灯说：</Text>
              <Text>{"\n"}没有错题，太厉害了！</Text>
              <Text>{"\n"}继续保持哦～</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Wrong Questions List ─────────────────────────────────

  return (
    <View className="app-phone-frame">
      <ScrollView className="app-phone-content wrongbook-page" scrollY>
        <View className="status-bar-spacer" />

        <View className="page-header">
          <View className="section-bar red" style={{ display: "inline-block", marginRight: "8px" }} />
          <Text style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700 }}>
            错题本
          </Text>
        </View>

        {/* Filter Tabs */}
        <View className="wrongbook-tabs">
          <View
            className={`comic-btn sm ${filter === undefined ? "red" : "outline"}`}
            onClick={() => handleFilterChange(undefined)}
          >
            <Text>全部 ({total})</Text>
          </View>
          <View
            className={`comic-btn sm ${filter === 0 ? "red" : "outline"}`}
            onClick={() => handleFilterChange(0)}
          >
            <Text>待复习 ({unresolvedCount})</Text>
          </View>
          <View
            className={`comic-btn sm ${filter === 1 ? "green" : "outline"}`}
            onClick={() => handleFilterChange(1)}
          >
            <Text>已掌握 ({resolvedCount})</Text>
          </View>
        </View>

        {/* Grouped by Domain */}
        {groups.map((group) => (
          <View key={group.domain} className="wrongbook-group">
            <View className="wrongbook-group-header">
              <View className="section-bar yellow" />
              <Text className="wrongbook-domain-name">{group.domain}</Text>
              <View className="badge wrongbook-count-badge">
                <Text>{group.count}</Text>
              </View>
            </View>

            {group.questions.map((q) => (
              <View
                key={q.id}
                className="wrongbook-item comic-card"
                onClick={() => handleQuestionClick(q.id)}
              >
                <View className="wrongbook-item-top">
                  <Text className="wrongbook-item-q">
                    {truncateText(q.content)}
                  </Text>
                  <View className={`badge ${q.resolved ? "green" : ""}`}>
                    <Text>{q.resolved ? "已掌握" : "待复习"}</Text>
                  </View>
                </View>
                <View className="wrongbook-item-bottom">
                  <Text className="wrongbook-item-date">
                    {formatDate(q.created_at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Bottom padding */}
        <View style={{ height: "16px" }} />
      </ScrollView>
    </View>
  );
}
