import { createContext, useContext, useState, useEffect } from "react";

export const THEMES = [
  { id: "light",  label: "Clair",  icon: "☀️",  description: "Thème clair classique" },
  { id: "dark",   label: "Sombre", icon: "🌙",  description: "Thème sombre reposant"  },
  { id: "violet", label: "Violet", icon: "💜",  description: "Thème violet élégant"   },
];

const ThemeContext = createContext({
  theme: "light",
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem("edugest_theme") || "light"
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark", "theme-violet", "dark");
    root.classList.add(`theme-${theme}`);
    if (theme === "dark") root.classList.add("dark");
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem("edugest_theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
