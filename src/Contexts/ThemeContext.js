import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useEffect, useMemo, useState } from "react";
import { getPalette } from "../theme/palettes";

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

  const colors = useMemo(() => getPalette(themeMode), [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};
