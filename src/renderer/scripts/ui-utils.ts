type ToastType = 'success' | 'error' | 'warning' | 'info';

const icons: Record<ToastType, string> = {
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
  error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
  info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>`,
};

export function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function showToast(message: string, type: ToastType = 'info', duration = 3000): void {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon" style="color:var(--${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'info'})">${icons[type]}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;

  container.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close') as HTMLButtonElement;
  const dismiss = () => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  closeBtn.addEventListener('click', dismiss);
  if (duration > 0) setTimeout(dismiss, duration);
}

export function openModal(content: string, options?: { width?: string }): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  if (options?.width) modal.style.maxWidth = options.width;
  modal.innerHTML = content;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Close on backdrop click
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal(backdrop);
  });

  // Close on Escape
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { closeModal(backdrop); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  return backdrop;
}

export function closeModal(backdrop: HTMLElement): void {
  backdrop.style.opacity = '0';
  backdrop.style.transition = 'opacity 0.15s';
  setTimeout(() => backdrop.remove(), 150);
}

export function confirm(message: string, title = 'Confirm'): Promise<boolean> {
  return new Promise(resolve => {
    const bd = openModal(`
      <div class="modal-header"><h2>${escapeHtml(title)}</h2></div>
      <div class="modal-body"><p style="color:var(--text-secondary)">${escapeHtml(message)}</p></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger"    id="confirm-ok">Confirm</button>
      </div>`);

    bd.querySelector('#confirm-cancel')!.addEventListener('click', () => { closeModal(bd); resolve(false); });
    bd.querySelector('#confirm-ok')!.addEventListener('click',     () => { closeModal(bd); resolve(true); });
  });
}

export function setLoading(btn: HTMLButtonElement | null, loading: boolean): void {
  if (!btn) return;
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
    const label = btn.querySelector('.btn-label') ?? btn;
    if (!btn.querySelector('.btn-spinner')) {
      const sp = document.createElement('span');
      sp.className = 'btn-spinner';
      btn.style.position = 'relative';
      btn.insertBefore(sp, btn.firstChild);
    }
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.querySelector('.btn-spinner')?.remove();
  }
}

export function renderSkeleton(container: HTMLElement, rows = 5): void {
  container.innerHTML = Array.from({ length: rows })
    .map(() => `<div class="skeleton skeleton-row"></div>`)
    .join('');
}

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface CustomSelectOption {
  label: string;
  value: string;
}

export function createCustomSelect(container: HTMLElement, options: {
  options: CustomSelectOption[];
  initialValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  id?: string;
}): void {
  const { options: list, initialValue, onChange, placeholder = 'Select...', id } = options;
  let currentValue = initialValue ?? '';
  const currentLabel = list.find(o => o.value === currentValue)?.label ?? placeholder;

  container.innerHTML = `
    <div class="custom-select-wrap" ${id ? `id="${id}-wrap"` : ''}>
      <button class="custom-select-trigger" type="button" ${id ? `id="${id}-trigger"` : ''}>
        <span class="trigger-label">${escapeHtml(currentLabel)}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="custom-select-menu">
        ${list.map(opt => `
          <div class="custom-select-option ${opt.value === currentValue ? 'selected' : ''}" data-value="${escapeHtml(opt.value)}">
            <span>${escapeHtml(opt.label)}</span>
            <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const wrap = container.querySelector('.custom-select-wrap') as HTMLElement;
  const trigger = wrap.querySelector('.custom-select-trigger') as HTMLButtonElement;
  const menu = wrap.querySelector('.custom-select-menu') as HTMLElement;
  const triggerLabel = wrap.querySelector('.trigger-label') as HTMLElement;

  const toggle = (force?: boolean) => {
    const isOpen = typeof force === 'boolean' ? force : !wrap.classList.contains('open');
    if (isOpen) {
      // Close others
      document.querySelectorAll('.custom-select-wrap.open').forEach(el => {
        if (el !== wrap) el.classList.remove('open');
      });
      wrap.classList.add('open');
    } else {
      wrap.classList.remove('open');
    }
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  wrap.querySelectorAll('.custom-select-option').forEach(optEl => {
    optEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = (optEl as HTMLElement).dataset.value!;
      const label = (optEl as HTMLElement).querySelector('span')!.textContent!;

      currentValue = val;
      triggerLabel.textContent = label;

      wrap.querySelectorAll('.custom-select-option').forEach(el => el.classList.remove('selected'));
      optEl.classList.add('selected');

      toggle(false);
      if (onChange) onChange(val);
    });
  });

  document.addEventListener('click', () => toggle(false));
}
