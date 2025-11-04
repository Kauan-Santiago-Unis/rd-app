import Ionicons from "@expo/vector-icons/Ionicons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useContext } from "react";
import { Platform, StyleSheet } from "react-native";
import { ThemeContext } from "../Contexts/ThemeContext";
import Home from "../Screens/Home";
import ProfileScreen from "../Screens/Perfil";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { themeMode } = useContext(ThemeContext);
  const isDark = themeMode === "dark";

  const THEME = isDark
    ? {
      active: "#c3a382",
      inactive: "#9CA3AF",
      bg: "#0B1220",
      card: "#111827",
      border: "rgba(255,255,255,0.08)",
      text: "#F8FAFC",
    }
    : {
      active: "#a37f5e",
      inactive: "#9CA3AF",
      bg: "#FFFFFF",
      card: "#FFFFFF",
      border: "rgba(15,23,42,0.08)",
      text: "#0F172A",
    };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: THEME.active,
        tabBarInactiveTintColor: THEME.inactive,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
        tabBarStyle: [
          styles.tabBarBase,
          {
            backgroundColor: THEME.card,
            borderTopColor: THEME.border,
          },
          Platform.select({
            ios: { height: 60 },
            android: { height: 60, elevation: 8 },
          }),
        ],
        tabBarIcon: ({ color, size, focused }) => {
          let icon = "ellipse";
          if (route.name === "Home") icon = focused ? "home" : "home-outline";
          if (route.name === "Perfil") icon = focused ? "person" : "person-outline";
          return <Ionicons name={icon} size={size} color={color} />;
        },
        tabBarHideOnKeyboard: true,
      })}
      sceneContainerStyle={{ backgroundColor: THEME.bg }}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarBase: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
});
