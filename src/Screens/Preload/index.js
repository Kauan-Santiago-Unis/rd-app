import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useContext, useEffect } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { ThemeContext } from "../../Contexts/ThemeContext";

export default function Preload() {
  const navigation = useNavigation();
  const { themeMode, colors } = useContext(ThemeContext);
  const isDark = themeMode === "dark";
  const fadeAnim = new Animated.Value(0);

  const THEME = colors;

  // ✨ Fade-in animado
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();
  }, []);

  // 🔍 Checa se há usuário logado
  useEffect(() => {
    const checkToken = async () => {
      try {
        const userData = await AsyncStorage.getItem("@userDetails");

        setTimeout(() => {
          if (userData) {
            navigation.reset({
              routes: [{ name: "MainTab" }],
            });
          } else {
            navigation.reset({
              routes: [{ name: "SignIn" }],
            });
          }
        }, 1500); // Delay suave pra exibir o splash
      } catch (e) {
        console.log("Erro ao checar token:", e);
        navigation.reset({
          routes: [{ name: "SignIn" }],
        });
      }
    };

    checkToken();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />

      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
        {/* 🏷️ Logo / nome do app */}
        <Text style={[styles.title, { color: THEME.text }]}>AgroSync</Text>
        <Text style={[styles.subtitle, { color: THEME.muted }]}>Coffee Campo</Text>

        {/* 🔄 Loader */}
        <ActivityIndicator
          animating={true}
          size="large"
          color={THEME.primary}
          style={{ marginTop: 24 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: -6,
  },
});
