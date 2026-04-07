import { BrowserWindow, app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import log from 'electron-log';

let mainWindow: BrowserWindow | null = null;
let loginWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const preloadPath = () => path.join(__dirname, 'preload.js');

// ─── Login window ─────────────────────────────────────────────────────────────
export function createLoginWindow(): BrowserWindow {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return loginWindow;
  }
  loginWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    center: true,
    frame: false,
    resizable: true,
    backgroundColor: '#F5F4F0',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  loginWindow.loadFile(path.join(__dirname, '../renderer/login.html'));
  loginWindow.once('ready-to-show', () => loginWindow?.show());
  loginWindow.on('closed', () => { loginWindow = null; });
  return loginWindow;
}

// ─── Main window ──────────────────────────────────────────────────────────────
export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    center: true,
    frame: false,
    backgroundColor: '#F5F4F0',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.center();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  return mainWindow;
}

// ─── Accessors ────────────────────────────────────────────────────────────────
export function getMainWindow(): BrowserWindow | null { return mainWindow; }
export function getLoginWindow(): BrowserWindow | null { return loginWindow; }

export function closeLoginWindow(): void {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
    loginWindow = null;
  }
}
export function closeMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
export function setupTray(): void {
  try {
    const iconFile = path.join(__dirname, '../../assets/tray-icon.png');
    const icon = nativeImage.createFromPath(iconFile);
    if (icon.isEmpty()) { log.warn('Tray icon missing'); return; }
    tray = new Tray(icon);
    tray.setToolTip('Finch Invoice');
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: 'Open Finch',
        click: () => {
          if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
          else createMainWindow();
        },
      },
      {
        label: 'New Invoice',
        click: () => mainWindow?.webContents.send('app:shortcut', 'new-invoice'),
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('double-click', () => mainWindow?.show());
  } catch (err) {
    log.warn('Tray setup failed:', err);
  }
}
