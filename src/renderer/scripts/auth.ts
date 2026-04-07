import { showToast, setLoading, escapeHtml } from './ui-utils';
import { validateRequired, validatePassword, validateEmail, passwordStrength } from './validators';

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('auth-root');
  if (root) renderAuth(root);
});

export function renderAuth(container: HTMLElement): void {
  container.innerHTML = `
  <div class="login-shell">
    <div class="login-brand" id="brand-panel">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <div class="logo-mark" style="width:36px;height:36px;border-radius:10px;background:#E8C547;display:flex;align-items:center;justify-content:center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </div>
          <span style="font-size:1.25rem;font-weight:700;color:#E8C547;letter-spacing:-0.025em">Finch</span>
        </div>
        <h1 style="color:#EEE8D5;font-size:1.875rem;margin-bottom:12px;line-height:1.2">Invoice smarter,<br>not harder.</h1>
        <p style="color:rgba(238,232,213,0.65);font-size:0.9375rem;line-height:1.65;max-width:240px">Offline-first invoicing for freelancers and small businesses.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${['Create professional invoices', 'Manage clients & history', 'Export to PDF instantly', 'Works completely offline'].map(f => `
        <div style="display:flex;align-items:center;gap:10px;color:rgba(238,232,213,0.8);font-size:0.875rem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8C547" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          ${escapeHtml(f)}
        </div>`).join('')}
      </div>
      <!-- decorative circle -->
      <div style="position:absolute;bottom:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(232,197,71,0.08);pointer-events:none"></div>
    </div>

    <div class="login-form-panel" style="position:relative">
      <!-- Window controls -->
      <div style="position:absolute;top:16px;right:16px;display:flex;gap:6px" class="no-drag">
        <button class="win-btn close"    id="wc-close"    title="Close"></button>
        <button class="win-btn minimize" id="wc-minimize" title="Minimize"></button>
      </div>

      <div class="login-form-inner">
        <div class="tab-bar">
          <button class="tab-btn active" id="tab-login">Sign in</button>
          <button class="tab-btn"        id="tab-register">Create account</button>
        </div>

        <!-- Login form -->
        <form id="login-form" style="display:flex;flex-direction:column;gap:14px">
          <div class="form-group">
            <label class="form-label required">Username</label>
            <input class="form-input" id="login-username" type="text" placeholder="Your username" autocomplete="username">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label required">Password</label>
            <input class="form-input" id="login-password" type="password" placeholder="Your password" autocomplete="current-password">
            <span class="form-error"></span>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="login-btn" style="width:100%;margin-top:4px">
            <span class="btn-label">Sign in</span>
          </button>
        </form>

        <!-- Register form (hidden) -->
        <form id="register-form" style="display:none;flex-direction:column;gap:14px">
          <div class="form-group">
            <label class="form-label required">Username</label>
            <input class="form-input" id="reg-username" type="text" placeholder="Choose a username" autocomplete="username">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Email <span style="color:var(--text-tertiary);font-weight:400">(optional)</span></label>
            <input class="form-input" id="reg-email" type="email" placeholder="you@example.com" autocomplete="email">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label required">Password</label>
            <input class="form-input" id="reg-password" type="password" placeholder="Create a password" autocomplete="new-password">
            <div class="strength-bar" style="margin-top:6px"><div class="strength-fill" id="strength-fill" style="width:0%;background:#DC2626"></div></div>
            <span class="form-hint" id="strength-label">Choose a strong password</span>
            <span class="form-error"></span>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="register-btn" style="width:100%;margin-top:4px">
            <span class="btn-label">Create account</span>
          </button>
        </form>
      </div>
    </div>
  </div>`;

  initAuthHandlers();
}

function initAuthHandlers(): void {
  const tabLogin    = document.getElementById('tab-login')!    as HTMLButtonElement;
  const tabRegister = document.getElementById('tab-register')! as HTMLButtonElement;
  const loginForm   = document.getElementById('login-form')!   as HTMLFormElement;
  const registerForm = document.getElementById('register-form')! as HTMLFormElement;

  // Tab switching
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
  });
  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
  });

  // Password strength
  const regPwd = document.getElementById('reg-password') as HTMLInputElement;
  const strengthFill  = document.getElementById('strength-fill')!;
  const strengthLabel = document.getElementById('strength-label')!;
  regPwd?.addEventListener('input', () => {
    const s = passwordStrength(regPwd.value);
    strengthFill.style.width    = s.width;
    strengthFill.style.background = s.color;
    strengthLabel.textContent   = s.label;
  });

  // Window controls
  document.getElementById('wc-close')?.addEventListener('click', () => window.finchAPI.window.close());
  document.getElementById('wc-minimize')?.addEventListener('click', () => window.finchAPI.window.minimize());

  // Login submit
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const username = (document.getElementById('login-username') as HTMLInputElement).value.trim();
    const password = (document.getElementById('login-password') as HTMLInputElement).value;

    const vUser = validateRequired(username, 'Username');
    const vPass = validateRequired(password, 'Password');
    if (!vUser.valid) { showToast(vUser.message!, 'error'); return; }
    if (!vPass.valid) { showToast(vPass.message!, 'error'); return; }

    const btn = document.getElementById('login-btn') as HTMLButtonElement;
    setLoading(btn, true);
    const result = await window.finchAPI.auth.login({ username, password });
    setLoading(btn, false);

    if (!result.success) {
      showToast(result.error ?? 'Login failed', 'error');
    }
    // On success main process switches windows automatically
  });

  // Register submit
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const username = (document.getElementById('reg-username') as HTMLInputElement).value.trim();
    const email    = (document.getElementById('reg-email')    as HTMLInputElement).value.trim();
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;

    const vUser = validateRequired(username, 'Username');
    const vMail = validateEmail(email);
    const vPass = validatePassword(password);
    if (!vUser.valid) { showToast(vUser.message!, 'error'); return; }
    if (!vMail.valid) { showToast(vMail.message!, 'error'); return; }
    if (!vPass.valid) { showToast(vPass.message!, 'error'); return; }

    const btn = document.getElementById('register-btn') as HTMLButtonElement;
    setLoading(btn, true);
    const result = await window.finchAPI.auth.register({ username, email: email || undefined, password });
    setLoading(btn, false);

    if (!result.success) {
      showToast(result.error ?? 'Registration failed', 'error');
    }
    // On success main process auto-logs in and switches windows
  });
}
