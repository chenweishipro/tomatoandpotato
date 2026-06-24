"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import zh from "@/locales/zh.json";
import en from "@/locales/en.json";

export type Locale = "zh" | "en";
const dicts: Record<Locale, Record<string, string>> = { zh, en };

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>({ locale: "zh", setLocale: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("locale")) as Locale | null;
    const initial: Locale = saved || (navigator.language.startsWith("en") ? "en" : "zh");
    setLocaleState(initial);
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem("locale", l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }

  function t(key: string, vars?: Record<string, string | number>): string {
    let s = dicts[locale][key] || dicts.zh[key] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useT();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={
        "text-xs px-1.5 py-1 rounded-md bg-transparent border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 outline-none cursor-pointer " +
        className
      }
      aria-label="Language"
    >
      <option value="zh">中文</option>
      <option value="en">English</option>
    </select>
  );
}