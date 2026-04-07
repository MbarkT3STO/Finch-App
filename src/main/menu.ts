import { Menu, shell, app } from 'electron';
import { getMainWindow } from './window-manager';

function send(action: string) {
  getMainWindow()?.webContents.send('app:shortcut', action);
}

export function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Invoice', accelerator: 'CmdOrCtrl+N', click: () => send('new-invoice') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { type: 'separator' },
        { label: 'Export PDF', accelerator: 'CmdOrCtrl+Return', click: () => send('export-pdf') },
        { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => send('print') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('redo') },
        { type: 'separator' },
        { label: 'Duplicate Invoice', accelerator: 'CmdOrCtrl+D', click: () => send('duplicate') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+T', click: () => send('toggle-theme') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Finch', click: () => send('about') },
        { label: 'Report Issue', click: () => shell.openExternal('https://github.com') },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
