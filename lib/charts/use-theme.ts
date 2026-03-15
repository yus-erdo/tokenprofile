"use client";

import { useEffect, useState } from "react";

export function useTheme(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(document.documentElement.classList.contains("dark") || mq.matches);

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", handler);
    };
  }, []);

  return isDark;
}
