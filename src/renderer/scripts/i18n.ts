import en from '../../shared/translations/en.json';
import fr from '../../shared/translations/fr.json';
import ar from '../../shared/translations/ar.json';

const translations: Record<string, any> = { en, fr, ar };

let currentLang = 'en';

export function setLanguage(lang: string): void {
  const normalizedLang = lang.split('-')[0]; // Handle 'en-US' etc.
  if (translations[normalizedLang]) {
    currentLang = normalizedLang;
    document.documentElement.setAttribute('lang', normalizedLang);
    document.documentElement.setAttribute('dir', normalizedLang === 'ar' ? 'rtl' : 'ltr');
    updateDOM();
  }
}

export function getLanguage(): string {
  return currentLang;
}

export function t(path: string, vars?: Record<string, string | number>): string {
  const parts = path.split('.');
  let obj = translations[currentLang];
  if (!obj) return path;

  for (const part of parts) {
    obj = obj?.[part];
  }

  if (typeof obj !== 'string') return path;

  let str = obj;
  if (vars) {
    Object.entries(vars).forEach(([key, val]) => {
      str = str.replace(new RegExp(`{${key}}`, 'g'), String(val));
    });
  }
  return str;
}

export function updateDOM(): void {
  // Update text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')!;
    const varsStr = el.getAttribute('data-i18n-vars');
    let vars;
    if (varsStr) {
      try { vars = JSON.parse(varsStr); } catch(e) { console.error('i18n-vars error', e); }
    }
    el.textContent = t(key, vars);
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder')!;
    const varsStr = el.getAttribute('data-i18n-vars');
    let vars;
    if (varsStr) {
      try { vars = JSON.parse(varsStr); } catch(e) { console.error('i18n-vars error', e); }
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.placeholder = t(key, vars);
    }
  });

  // Update titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title')!;
    const varsStr = el.getAttribute('data-i18n-vars');
    let vars;
    if (varsStr) {
      try { vars = JSON.parse(varsStr); } catch(e) { console.error('i18n-vars error', e); }
    }
    (el as HTMLElement).title = t(key, vars);
  });
}
