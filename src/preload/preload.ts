import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

contextBridge.exposeInMainWorld('finchAPI', {
  auth: {
    register: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_REGISTER, d),
    login: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, d),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    getSession: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_SESSION),
    changePassword: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, d),
    deleteAccount: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_DELETE_ACCOUNT, d),
  },
  invoice: {
    create: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.INVOICE_CREATE, d),
    update: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.INVOICE_UPDATE, d),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.INVOICE_DELETE, id),
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.INVOICE_GET_ALL),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.INVOICE_GET, id),
    duplicate: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.INVOICE_DUPLICATE, id),
    updateStatus: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.INVOICE_UPDATE_STATUS, d),
  },
  client: {
    create: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CLIENT_CREATE, d),
    update: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CLIENT_UPDATE, d),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIENT_DELETE, id),
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.CLIENT_GET_ALL),
  },
  pdf: {
    export: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PDF_EXPORT, d),
    exportBatch: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PDF_EXPORT_BATCH, d),
    print: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PDF_PRINT, id),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (d: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, d),
  },
  backup: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_IMPORT),
  },
  csv: {
    save: (data: { csv: string; defaultName: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.CSV_SAVE, data),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
    showItemInFolder: (p: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, p),
  },
  window: {
    close: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
    minimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  },
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const allowed = ['app:shortcut'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, ...a) => cb(...a));
  },
  off: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcRenderer.off(channel, cb as Parameters<typeof ipcRenderer.off>[1]);
  },
});
