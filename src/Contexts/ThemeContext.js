import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useEffect, useState } from "react";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState("dark");

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("@themePreference");
      if (stored) setThemeMode(stored);
    })();
  }, []);

  const toggleTheme = async () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    await AsyncStorage.setItem("@themePreference", next);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
