import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useContext, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SyncContext } from "../../Contexts/SyncContext";
import { ThemeContext } from "../../Contexts/ThemeContext";
import { ApiError, api } from "../../services/api";

export default function SignIn() {
  const { themeMode } = useContext(ThemeContext);
  const { sync } = useContext(SyncContext);
  const isDark = themeMode === "dark";
  const navigation = useNavigation();

  const THEME = useMemo(
    () =>
      isDark
        ? {
          // modo escuro
          primary: "#c3a382", // areia médio (#c3a382)
          bg: "#111827", // fundo escuro
          card: "#1f2937", // container cinza intermediário
          border: "#374151", // borda cinza
          text: "#f3f4f6", // texto claro
          muted: "#d6c0a6", // texto secundário
          danger: "#F87171",
          icon: "#f3f4f6",
          chipBg: "rgba(195,163,130,0.18)",
          chipBorder: "rgba(195,163,130,0.35)",
        }
        : {
          // modo claro
          primary: "#a37f5e", // tom areia mais escuro (#a37f5e)
          bg: "#fbfaf8", // fundo claro
          card: "#ffffff", // cartão branco
          border: "#efe6dc", // borda clara
          text: "#533b29", // texto principal
          muted: "#8b684d", // texto secundário
          danger: "#EF4444",
          icon: "#533b29",
          chipBg: "rgba(163,127,94,0.10)",
          chipBorder: "rgba(163,127,94,0.25)",
        },
    [isDark]
  );


  const s = styles(THEME);

  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const [debugPayloadText, setDebugPayloadText] = useState("");
  const [pendingNavigation, setPendingNavigation] = useState(false);
  const [email, setEmail] = useState("");

  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const hasEmailError = email.length > 0 && !emailRegex.test(email);
  const canSubmit = emailRegex.test(email) && senha.length >= 1 && !loading;

  const navigateToMain = () => {
    navigation.reset({ routes: [{ name: "MainTab" }] });
  };

  const handleCloseDebugModal = () => {
    setDebugModalVisible(false);
    if (pendingNavigation) {
      setPendingNavigation(false);
      navigateToMain();
    }
  };

  const handleCopyDebugPayload = async () => {
    if (!debugPayloadText) return;
    try {
      await Clipboard.setStringAsync(debugPayloadText);
      Alert.alert("Debug", "JSON copiado para a area de transferencia.");
    } catch (_error) {
      Alert.alert("Erro", "Nao foi possivel copiar o JSON.");
    }
  };

  const handleForgot = () => {
    // troque por navegação para "ForgotPassword" se houver
    alert("Vamos te ajudar a recuperar sua senha 😉");
  };

  const handleLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);

    try {
      const data = await api.post(
        "http://192.168.2.10:7082/api/v1/user/login",
        {
          username: email.trim(),
          password: senha,
        },
        { auth: false }
      );

      // salva token e dados do usuário
      await AsyncStorage.setItem("@accessToken", data.accessToken);
      await AsyncStorage.setItem("@userDetails", JSON.stringify(data.userDetails));

      const syncResult = await sync({ silent: true });
      const safraPayloads = syncResult?.safraDebugPayloads;
      if (Array.isArray(safraPayloads) && safraPayloads.length > 0) {
        const payloadForDisplay =
          safraPayloads.length === 1 ? safraPayloads[0] : safraPayloads;
        const formattedPayload = JSON.stringify(payloadForDisplay, null, 2);
        setDebugPayloadText(formattedPayload);
        setPendingNavigation(true);
        setDebugModalVisible(true);
        return;
      }

      // Redireciona para o app principal quando nao ha debug pendente
      navigateToMain();
    } catch (error) {
      const stringifyDetail = (value) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (value instanceof Error) return value.message;
        if (typeof value === "object") {
          if (typeof value.message === "string") return value.message;
          if (typeof value.error === "string") return value.error;
          try {
            return JSON.stringify(value);
          } catch (_jsonError) {
            return String(value);
          }
        }
        return String(value);
      };

      const details = new Set();
      if (error instanceof ApiError) {
        console.log("Erro de login:", error.details || error.message, error.cause);
        details.add(stringifyDetail(error.details));
        details.add(stringifyDetail(error.cause));
        details.add(stringifyDetail(error.message));
      } else {
        console.error("Erro inesperado no login:", error);
        details.add(stringifyDetail(error));
      }

      const detailMessage = Array.from(details)
        .map((msg) => msg.trim())
        .filter((msg) => msg.length > 0)
        .join(" | ");

      alert(
        detailMessage
          ? `Falha no login.\nDetalhes: ${detailMessage}`
          : "Falha no login. Verifique seus dados e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={[s.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} animated />
      <Modal
        visible={debugModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseDebugModal}
      >
        <View style={s.debugOverlay}>
          <View style={[s.card, s.debugModalCard]}>
            <Text style={s.debugTitle}>JSON enviado (debug)</Text>
            <Text style={s.debugSubtitle}>
              Conteudo enviado para o backend durante a sincronizacao.
            </Text>
            <ScrollView
              style={s.debugScroll}
              contentContainerStyle={s.debugScrollContent}
            >
              <Text style={s.debugJson}>{debugPayloadText}</Text>
            </ScrollView>
            <View style={s.debugActions}>
              <TouchableOpacity
                style={[s.debugButton, s.debugCopyButton]}
                onPress={handleCopyDebugPayload}
              >
                <Ionicons name="copy-outline" size={18} color="#fff" />
                <Text style={s.debugButtonText}>Copiar JSON</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.debugButton, s.debugCloseButton]}
                onPress={handleCloseDebugModal}
              >
                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                <Text style={s.debugButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.content}>
            {/* Brand / Header */}
            <View style={s.brand}>
              <View style={s.logoCircle}>
                <Ionicons name="cafe" size={26} color="#fff" />
              </View>
              <Text style={s.appTitle}>Agrosync Campo</Text>
              <Text style={s.appSubtitle}>Faça login para continuar</Text>
            </View>

            {/* Card de Login */}
            <View style={s.card}>
              {/* Email */}
              <Text style={s.inputLabel}>Email</Text>
              <View style={s.inputRow}>
                <Ionicons name="mail-outline" size={18} color={THEME.muted} style={s.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={s.input}
                  placeholder="Digite seu email"
                  placeholderTextColor={THEME.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailRegex.test(email) && (
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                )}
              </View>
              {hasEmailError && <Text style={s.errorText}>Email inválido</Text>}

              {/* Senha */}
              <Text style={[s.inputLabel, { marginTop: 12 }]}>Senha</Text>
              <View style={s.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={THEME.muted} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Digite sua senha"
                  placeholderTextColor={THEME.muted}
                  secureTextEntry={!showPwd}
                  value={senha}
                  onChangeText={setSenha}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPwd((p) => !p)} hitSlop={8}>
                  <Ionicons
                    name={showPwd ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={THEME.muted}
                  />
                </Pressable>
              </View>

              {/* Lembrar de mim + Esqueci senha */}
              <View style={s.rowBetween}>
                <Pressable style={s.rememberRow} onPress={() => setRemember((r) => !r)}>
                  <Ionicons
                    name={remember ? "checkbox" : "square-outline"}
                    size={18}
                    color={THEME.primary}
                  />
                  <Text style={s.rememberText}>Lembrar de mim</Text>
                </Pressable>
                <TouchableOpacity onPress={handleForgot}>
                  <Text style={s.link}>Esqueci minha senha</Text>
                </TouchableOpacity>
              </View>

              {/* Botão Entrar com gradiente */}
              <TouchableOpacity
                disabled={!canSubmit}
                style={[s.primaryBtn, !canSubmit && s.primaryBtnDisabled]}
                onPress={handleLogin}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={
                    canSubmit
                      ? ["#c3a382", "#a37f5e"]
                      : ["#d6c0a6", "#d6c0a6"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.primaryBtnGrad}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={18} color="#fff" />
                      <Text style={s.primaryBtnText}>Entrar</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Rodapé / Suporte */}
            <View style={s.footer}>
              <Text style={s.footerText}>
                Precisa de ajuda? <Text style={[s.link, { fontWeight: "700" }]}>Fale com o suporte</Text>
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

function styles(THEME) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
    },

    // Header
    brand: {
      alignItems: "center",
      marginBottom: 18,
    },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: THEME.primary,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      marginBottom: 10,
    },
    appTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: THEME.text,
    },
    appSubtitle: {
      fontSize: 13,
      color: THEME.muted,
      marginTop: 4,
    },

    // Card
    card: {
      backgroundColor: THEME.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: THEME.border,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },

    // Inputs
    inputLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: THEME.text,
      marginBottom: 6,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: THEME.border,
      backgroundColor: THEME.card,
      paddingHorizontal: 12,
      height: 46,
    },
    inputIcon: { marginRight: 8 },
    input: {
      flex: 1,
      color: THEME.text,
      fontSize: 16,
      paddingVertical: 0,
    },
    errorText: {
      color: THEME.danger,
      marginTop: 6,
      fontSize: 12,
      fontWeight: "600",
    },

    // Row lembrete / esqueci
    rowBetween: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    rememberText: { color: THEME.text, fontSize: 13, fontWeight: "600" },

    link: {
      color: THEME.primary,
      fontSize: 13,
      fontWeight: "700",
    },

    // Botão principal
    primaryBtn: {
      marginTop: 16,
      borderRadius: 12,
      overflow: "hidden",
    },
    primaryBtnDisabled: {
      opacity: 0.7,
    },
    primaryBtnGrad: {
      height: 48,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "800",
    },

    // Footer
    footer: { marginTop: 16, alignItems: "center" },
    footerText: { color: THEME.muted, fontSize: 12, textAlign: "center" },
    // Debug modal
    debugOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    debugModalCard: {
      width: "100%",
      maxWidth: 620,
      maxHeight: "80%",
    },
    debugTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: THEME.text,
    },
    debugSubtitle: {
      fontSize: 12,
      color: THEME.muted,
      marginTop: 6,
    },
    debugScroll: {
      marginTop: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: THEME.border,
      backgroundColor: THEME.card,
    },
    debugScrollContent: {
      padding: 12,
    },
    debugJson: {
      color: THEME.text,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: Platform.select({
        ios: "Menlo",
        android: "monospace",
        default: "monospace",
      }),
    },
    debugActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
    },
    debugButton: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    debugCopyButton: {
      backgroundColor: THEME.primary,
    },
    debugCloseButton: {
      backgroundColor: THEME.danger,
    },
    debugButtonText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
