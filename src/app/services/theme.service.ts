import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'enisolar_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  isDark = signal<boolean>(this.loadInitialTheme());

  private loadInitialTheme(): boolean {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === 'dark';
    // Respect system preference as default
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  toggle() {
    this.setDark(!this.isDark());
  }

  setDark(dark: boolean) {
    this.isDark.set(dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark-theme', dark);
    document.documentElement.classList.toggle('light-theme', !dark);
  }

  init() {
    // Called once at app startup
    this.setDark(this.isDark());
  }
}
