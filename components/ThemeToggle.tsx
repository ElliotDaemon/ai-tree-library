"use client";
import { MoonIcon, SunIcon } from "./Icons";

export default function ThemeToggle() {
  const flip = () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    window.dispatchEvent(new Event("themechange"));
  };
  return (
    <button className="pill icon-btn" onClick={flip} aria-label="Switch light and dark">
      <span className="theme-sun"><SunIcon size={16} /></span>
      <span className="theme-moon"><MoonIcon size={16} /></span>
    </button>
  );
}
