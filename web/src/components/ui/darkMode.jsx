import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.theme === 'dark' ||
        (!('theme' in localStorage) &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);
  return (
    <Button
      className="size-12 bg-transparent ml-2"
      onClick={() => setIsDark((prev) => !prev)}
    >
      {isDark ? <Moon color="white" className="sm:size-6 md:size-8 lg:size-8"/> : <Sun color="black" className="sm:size-6 md:size-8 lg:size-8"/>}
    </Button>   
  );
}