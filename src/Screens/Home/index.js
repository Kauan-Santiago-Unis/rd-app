import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useContext, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SyncContext } from "../../Contexts/SyncContext";
import { ThemeContext } from "../../Contexts/ThemeContext";

export default function Home({ navigation }) {
  const { themeMode } = useContext(ThemeContext);
  const { syncing, status: syncStatusText, error: syncError } = useContext(SyncContext);

  const isDark = themeMode === "dark";

  const THEME = useMemo(
    () =>
      isDark
        ? {
          primary: "#c3a382",
          primaryDark: "#a37f5e",
          bg: "#111827",
          card: "#1f2937",
          border: "#374151",
          text: "#f3f4f6",
          muted: "#d6c0a6",
          danger: "#F87171",
          success: "#10B981",
          warning: "#FBBF24",
        }
        : {
          primary: "#a37f5e",
          primaryDark: "#8b684d",
          bg: "#fbfaf8",
          card: "#ffffff",
          border: "#efe6dc",
          text: "#533b29",
          muted: "#8b684d",
          danger: "#EF4444",
          success: "#15803D",
          warning: "#CA8A04",
        },
    [isDark]
  );

  const s = styles(THEME);

  const isSynced = syncStatusText === "Tudo sincronizado";
  const statusColor = isSynced ? THEME.success : syncError ? THEME.danger : THEME.warning;
  const statusIcon = isSynced ? "checkmark-circle-outline" : "alert-circle-outline";

  // ⚙️ Sincronização inicial
  ;

  // 💫 Animação nos botões
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />

      {/* 🔄 Status de sincronização */}
      <View style={s.syncStatus}>
        {syncing ? (
          <ActivityIndicator size="small" color={THEME.warning} style={{ marginRight: 6 }} />
        ) : (
          <Ionicons
            name={statusIcon}
            size={16}
            color={statusColor}
            style={{ marginRight: 6 }}
          />
        )}
        <Text
          style={[
            s.syncText,
            {
              color: statusColor,
            },
          ]}
        >
          {syncStatusText}
        </Text>
      </View>

      {/* Cabeçalho */}
      <View style={s.header}>
        <Text style={s.title}>AgroSync Coffee Campo</Text>
        <Text style={s.subtitle}>Bem-vindo de volta</Text>
      </View>

      {/* Cards */}
      <View style={s.grid}>
        <TouchableWithoutFeedback
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => navigation.navigate("Safra")}
        >
          <Animated.View
            style={[s.card, { transform: [{ scale: scaleAnim }] }]}
          >
            <LinearGradient
              colors={[THEME.primary, THEME.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.cardGrad}
            >
              <View style={s.iconCircle}>
                <Ionicons name="leaf-outline" size={30} color="#fff" />
              </View>
              <Text style={s.cardLabel}>Previsão de Safra</Text>
            </LinearGradient>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </SafeAreaView>
  );
}

function styles(THEME) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "flex-start",
      alignItems: "center",
      paddingTop: 10,
    },
    syncStatus: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
      marginBottom: 20,
      backgroundColor: THEME.card,
      borderWidth: 1,
      borderColor: THEME.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    syncText: {
      fontSize: 13,
      fontWeight: "600",
    },
    header: {
      alignItems: "center",
      marginBottom: 35,
    },
    title: {
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: THEME.text,
    },
    subtitle: {
      fontSize: 15,
      color: THEME.muted,
      marginTop: 4,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 22,
    },
    card: {
      width: 140,
      height: 140,
      borderRadius: 24,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    cardGrad: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 12,
    },
    iconCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
    },
    cardLabel: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 0.4,
    },
  });
}
