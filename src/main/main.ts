import { app } from 'electron';
import log from 'electron-log';
import { createLoginWindow, createMainWindow, setupTray } from './window-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { buildMenu } from './menu';
import { getSession } from '../services/auth-service';

log.initialize({ preload: false });
log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

// Single instance
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  const { getMainWindow, getLoginWindow } = require('./window-manager');
  const w = getMainWindow() ?? getLoginWindow();
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});

app.whenReady().then(() => {
  log.info('App ready, version:', app.getVersion());
  registerIpcHandlers();
  buildMenu();
  const r = getSession();
  if (r.success && r.data) {
    log.info('Resuming session:', r.data.username);
    createMainWindow();
  } else {
    createLoginWindow();
  }
  setupTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  const { getMainWindow, getLoginWindow, createMainWindow: cm, createLoginWindow: cl } =
    require('./window-manager');
  if (!getMainWindow() && !getLoginWindow()) {
    getSession().success ? cm() : cl();
  }
});

// Security: prevent renderer from opening external pages inline
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (ev, url) => {
    if (!url.startsWith('file://') && !url.startsWith('data:')) {
      ev.preventDefault();
      log.warn('Blocked navigation to:', url);
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});
