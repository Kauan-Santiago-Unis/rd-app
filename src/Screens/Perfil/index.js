import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeContext } from "../../Contexts/ThemeContext";
import { SyncContext } from "../../Contexts/SyncContext";
import * as Clipboard from "expo-clipboard";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // =========================
  // ?? Tema dinamico
  // =========================
  const { themeMode, toggleTheme, colors } = useContext(ThemeContext);
  const { sync, syncing, status: syncStatus, lastSyncAt, error: syncError } = useContext(SyncContext);

  const THEME = colors;
  const s = styles(THEME);
  const lastSyncFormatted = useMemo(() => {
    if (!lastSyncAt) return "Nunca sincronizado";
    try {
      return new Date(lastSyncAt).toLocaleString();
    } catch (_e) {
      return lastSyncAt;
    }
  }, [lastSyncAt]);


  // =========================
  // 👤 Usuário e sync
  // =========================
  const [user, setUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [debugPayloadText, setDebugPayloadText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@userDetails");
        if (raw) {
          setUser(JSON.parse(raw));
        } else {
          setUser({
            firstName: "BrasilSync",
            email: "developers@brasilsync.com.br",
            phoneNumber: "(35) 3267-3269",
          });
        }
      } catch (e) {
        console.log("Erro ao carregar perfil:", e);
      }
    })();
  }, []);

  const handleLogout = async () => {
    const keysToRemove = [
      "@accessToken",
      "@userDetails",
      "@produtorSelecionado",
      "@propriedadeSelecionada",
    ];

    try {
      await AsyncStorage.multiRemove(keysToRemove);
    } catch (error) {
      console.log("Erro ao limpar dados sensiveis:", error);
    }

    navigation.reset({ routes: [{ name: "SignIn" }] });
  };

  const openSyncModal = () => {
    if (syncing) return;
    setShowResult(false);
    setDebugPayloadText("");
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowResult(false);
    setDebugPayloadText("");
  };

  const handleSync = async () => {
    if (syncing) return;
    try {
      setShowResult(false);
      const result = await sync();
      const safraPayloads = result?.safraDebugPayloads;
      if (Array.isArray(safraPayloads) && safraPayloads.length > 0) {
        const payloadForDisplay =
          safraPayloads.length === 1 ? safraPayloads[0] : safraPayloads;
        const formattedPayload = JSON.stringify(payloadForDisplay, null, 2);
        setDebugPayloadText(formattedPayload);
      } else {
        setDebugPayloadText("");
      }
      setShowResult(true);
      if (!safraPayloads || safraPayloads.length === 0) {
        setTimeout(() => {
          closeModal();
        }, 1200);
      }
    } catch (err) {
      setShowResult(true);
      setDebugPayloadText("");
      console.log('Erro na sincronizacao manual:', err);
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

  if (!user) {
    return (
      <SafeAreaView
        style={[s.container, { justifyContent: "center", alignItems: "center" }]}
      >
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />
        <Text style={{ color: THEME.text }}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  // 📦 Versão e ambiente
  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const appEnv = Constants.expoConfig?.extra?.env || __DEV__ ? "Development" : "Production";

  return (
    <SafeAreaView style={[s.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />

      {/* 🔙 Topbar */}
      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color={THEME.text} />
        </TouchableOpacity>
        <Text style={s.title}>Meu Perfil</Text>

        <TouchableOpacity onPress={toggleTheme} style={s.iconBtn}>
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={20}
            color={THEME.text}
          />
        </TouchableOpacity>
      </View>

      {/* 🧑 Card do usuário */}
      <View style={[s.profileCard, { marginTop: 80 }]}>
        <View style={s.avatar}>
          <Ionicons name="person-outline" size={36} color={THEME.primary} />
        </View>

        <Text style={s.name}>{user.firstName}</Text>

        <View style={s.infoBlock}>
          <Ionicons name="mail-outline" size={16} color={THEME.muted} />
          <Text style={s.infoText}>{user.email}</Text>
        </View>

        <View style={s.infoBlock}>
          <Ionicons name="call-outline" size={16} color={THEME.muted} />
          <Text style={s.infoText}>{user.phoneNumber}</Text>
        </View>

        <TouchableOpacity
          style={[s.syncBtn, syncing && s.syncBtnDisabled]}
          onPress={openSyncModal}
          disabled={syncing}
        >

          <Ionicons name="sync-outline" size={18} color="#fff" />
          <Text style={s.syncText}>Sincronizar</Text>
        </TouchableOpacity>
        <Text style={s.syncInfo}>Ultima sincronizacao: {lastSyncFormatted}</Text>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={s.logoutText}>Sair</Text>
        </TouchableOpacity>

        {/* 🧾 Versão e Ambiente */}
        <View style={s.versionBox}>
          <Text style={[s.versionText, { color: THEME.muted }]}>
            Versão {appVersion} • {appEnv}
          </Text>
        </View>
      </View>

      {/* Modal */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            {syncing ? (
              <>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={s.modalTitle}>{syncStatus}</Text>
              </>
            ) : showResult ? (
              syncError ? (
                <>
                  <Ionicons name="alert-circle-outline" size={36} color={THEME.danger} />
                  <Text style={[s.modalTitle, { color: THEME.danger }]}>Erro na sincronizacao</Text>
                  <Text style={s.modalSubtitle}>{syncStatus}</Text>
                  <View style={s.modalActions}>
                    <Pressable style={[s.btn, s.btnGhost]} onPress={closeModal}>
                      <Text style={[s.btnText, { color: THEME.text }]}>Fechar</Text>
                    </Pressable>
                    <Pressable
                      style={[s.btn, s.btnPrimary, syncing && s.btnDisabled]}
                      onPress={handleSync}
                      disabled={syncing}
                    >
                      <Text style={[s.btnText, { color: "#fff" }]}>Tentar novamente</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={36} color={THEME.success} />
                  <Text style={[s.modalTitle, { color: THEME.success }]}>Sincronizacao concluida</Text>
                  <Text style={s.modalSubtitle}>Atualizado em {lastSyncFormatted}</Text>
                  {debugPayloadText ? (
                    <>
                      <Text style={s.debugLabel}>JSON enviado (debug)</Text>
                      <ScrollView
                        style={s.debugScroll}
                        contentContainerStyle={s.debugScrollContent}
                      >
                        <Text style={s.debugJson}>{debugPayloadText}</Text>
                      </ScrollView>
                      <View style={s.debugActions}>
                        <Pressable
                          style={[s.debugButton, s.debugCopyButton]}
                          onPress={handleCopyDebugPayload}
                        >
                          <Ionicons name="copy-outline" size={18} color="#fff" />
                          <Text style={s.debugButtonText}>Copiar JSON</Text>
                        </Pressable>
                        <Pressable
                          style={[s.debugButton, s.debugCloseButton]}
                          onPress={closeModal}
                        >
                          <Ionicons name="close-circle-outline" size={18} color="#fff" />
                          <Text style={s.debugButtonText}>Fechar</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <Pressable style={[s.btn, s.btnPrimary]} onPress={closeModal}>
                      <Text style={[s.btnText, { color: "#fff" }]}>Fechar</Text>
                    </Pressable>
                  )}
                </>
              )
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={36} color={THEME.primary} />
                <Text style={s.modalTitle}>Sincronizar com o servidor?</Text>
                <Text style={s.modalSubtitle}>Ultima sincronizacao: {lastSyncFormatted}</Text>
                <View style={s.modalActions}>
                  <Pressable style={[s.btn, s.btnGhost]} onPress={closeModal}>
                    <Text style={[s.btnText, { color: THEME.text }]}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btn, s.btnPrimary, syncing && s.btnDisabled]}
                    onPress={handleSync}
                    disabled={syncing}
                  >
                    <Text style={[s.btnText, { color: "#fff" }]}>Sincronizar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function styles(THEME) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 6,
      paddingBottom: 10,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: THEME.border,
      backgroundColor: THEME.card,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: THEME.text,
    },
    profileCard: {
      backgroundColor: THEME.card,
      borderRadius: 20,
      padding: 26,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      borderWidth: 1,
      borderColor: THEME.border,
      marginHorizontal: 8,
    },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(195,163,130,0.15)",
      borderWidth: 1,
      borderColor: THEME.primaryDark,
      marginBottom: 14,
    },
    name: {
      fontSize: 21,
      fontWeight: "800",
      color: THEME.text,
      marginBottom: 18,
    },
    infoBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    infoText: {
      color: THEME.muted,
      fontSize: 15,
      fontWeight: "500",
    },
    syncBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: THEME.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14,
      gap: 8,
      marginTop: 24,
    },
    syncBtnDisabled: {
      opacity: 0.6,
    },
    syncInfo: {
      color: THEME.muted,
      fontSize: 12,
      marginTop: 8,
    },
    syncText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: THEME.primaryDark,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14,
      gap: 8,
      marginTop: 14,
    },
    logoutText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },
    versionBox: {
      marginTop: 24,
      paddingVertical: 4,
    },
    versionText: {
      fontSize: 13,
      fontWeight: "500",
      textAlign: "center",
      opacity: 0.7,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: THEME.card,
      borderRadius: 16,
      padding: 24,
      width: "100%",
      alignItems: "center",
      borderWidth: 1,
      borderColor: THEME.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: THEME.text,
      marginTop: 16,
      marginBottom: 6,
    },
    modalSubtitle: {
      color: THEME.muted,
      fontSize: 14,
      textAlign: "center",
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
      width: "100%",
      marginTop: 4,
    },
    btn: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimary: {
      backgroundColor: THEME.primary,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    btnGhost: {
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: 1,
      borderColor: THEME.border,
    },
    btnText: {
      fontSize: 15,
      fontWeight: "700",
    },
    debugLabel: {
      alignSelf: "flex-start",
      marginTop: 16,
      marginBottom: 6,
      fontSize: 12,
      fontWeight: "700",
      color: THEME.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    debugScroll: {
      maxHeight: 220,
      width: "100%",
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
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 16,
      width: "100%",
    },
    debugButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
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
