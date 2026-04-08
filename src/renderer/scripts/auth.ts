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
      <div class="login-brand-content">
        <div class="login-logo-wrap">
          <div class="logo-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </div>
          <span class="logo-text">Finch</span>
        </div>
        <h1 class="login-title">Invoice smarter,<br>not harder.</h1>
        <p class="login-subtitle">Offline-first invoicing for freelancers and small businesses.</p>
        
        <div class="login-features">
          ${['Create professional invoices', 'Manage clients & history', 'Export to PDF instantly', 'Works completely offline'].map(f => `
          <div class="login-feature-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            <span>${escapeHtml(f)}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="login-bg-decoration"></div>
    </div>

    <div class="login-form-panel">
      <!-- Window controls -->
      <div class="login-win-controls">
        <button class="win-btn minimize" id="wc-minimize" title="Minimize"></button>
        <button class="win-btn close"    id="wc-close"    title="Close"></button>
      </div>

      <div class="login-form-inner">
        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login">Sign in</button>
          <button class="auth-tab"        id="tab-register">Create account</button>
        </div>

        <!-- Login form -->
        <form id="login-form" class="auth-form">
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
          <button type="submit" class="btn btn-primary btn-lg" id="login-btn" style="width:100%;margin-top:8px">
            <span class="btn-label">Sign in</span>
          </button>
        </form>

        <!-- Register form (hidden) -->
        <form id="register-form" class="auth-form" style="display:none">
          <div class="form-group">
            <label class="form-label required">Username</label>
            <input class="form-input" id="reg-username" type="text" placeholder="Choose a username" autocomplete="username">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label">Email <span class="label-optional">(optional)</span></label>
            <input class="form-input" id="reg-email" type="email" placeholder="you@example.com" autocomplete="email">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label required">Password</label>
            <input class="form-input" id="reg-password" type="password" placeholder="Create a password" autocomplete="new-password">
            <div class="strength-bar"><div class="strength-fill" id="strength-fill"></div></div>
            <span class="form-hint" id="strength-label">Choose a strong password</span>
            <span class="form-error"></span>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" id="register-btn" style="width:100%;margin-top:8px">
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
