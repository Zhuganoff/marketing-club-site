// Переключатель «уменьшить движение» + prefers-reduced-motion.
const KEY = 'mc.reduceMotion';
export function reduceMotion()          {
  try { const v = localStorage.getItem(KEY); if (v !== null) return v === '1'; } catch { /* нет хранилища */ }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function setReduceMotion(on         ) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* нет хранилища */ }
  apply();
}
export function apply() { document.documentElement.classList.toggle('reduce-motion', reduceMotion()); }
