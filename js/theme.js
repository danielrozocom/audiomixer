import { elements, state } from './state.js';

export function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('audiomix_theme', theme);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  if (isDark) {
    elements.html.classList.add('dark');
  } else {
    elements.html.classList.remove('dark');
  }

  // Update Button Styles
  const btnSelected = 'p-1.5 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm transition';
  const btnUnselected = 'p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition';

  if (elements.themeLightBtn) elements.themeLightBtn.className = theme === 'light' ? btnSelected : btnUnselected;
  if (elements.themeDarkBtn) elements.themeDarkBtn.className = theme === 'dark' ? btnSelected : btnUnselected;
  if (elements.themeSystemBtn) elements.themeSystemBtn.className = theme === 'system' ? btnSelected : btnUnselected;
}

export function initTheme() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') applyTheme('system');
  });

  if (elements.themeLightBtn) elements.themeLightBtn.addEventListener('click', () => applyTheme('light'));
  if (elements.themeDarkBtn) elements.themeDarkBtn.addEventListener('click', () => applyTheme('dark'));
  if (elements.themeSystemBtn) elements.themeSystemBtn.addEventListener('click', () => applyTheme('system'));

  const savedTheme = localStorage.getItem('audiomix_theme') || 'system';
  applyTheme(savedTheme);
}
