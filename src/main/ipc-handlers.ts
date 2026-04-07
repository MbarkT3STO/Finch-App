import { ipcMain, ipcRenderer as _ir, shell, dialog, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import log from 'electron-log';
import { IPC_CHANNELS } from '../shared/constants';
import * as auth from '../services/auth-service';
import * as data from '../services/data-service';
import * as storage from '../services/storage-service';
import { generateInvoiceHtml } from './pdf-template';
import {
  createMainWindow,
  createLoginWindow,
  closeLoginWindow,
  closeMainWindow,
  getMainWindow,
} from './window-manager';

function session() {
  const r = auth.getSession();
  if (!r.success || !r.data) throw new Error('Not authenticated');
  return r.data;
}

export function registerIpcHandlers(): void {
  // ─── Window controls ───────────────────────────────────────────────────────
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, event => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, event => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, event => {
    const w = BrowserWindow.fromWebContents(event.sender);
    w?.isMaximized() ? w.unmaximize() : w?.maximize();
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.AUTH_REGISTER, async (_e, d) => {
    const r = await auth.registerUser(d.username, d.email, d.password);
    if (r.success) {
      // auto-login after register
      const lr = await auth.loginUser(d.username, d.password);
      if (lr.success) { closeLoginWindow(); createMainWindow(); }
    }
    return r;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_e, d) => {
    const r = await auth.loginUser(d.username, d.password);
    if (r.success) { closeLoginWindow(); createMainWindow(); }
    return r;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    const r = auth.logoutUser();
    closeMainWindow();
    createLoginWindow();
    return r;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => auth.getSession());

  ipcMain.handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (_e, d) => {
    const s = session();
    return auth.changePassword(s.userId, d.currentPassword, d.newPassword);
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_DELETE_ACCOUNT, async (_e, d) => {
    const s = session();
    const r = await auth.deleteAccount(s.userId, d.password);
    if (r.success) { closeMainWindow(); createLoginWindow(); }
    return r;
  });

  // ─── Invoice ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.INVOICE_CREATE, async (_e, d) => {
    const s = session();
    const settings = storage.getSettings(s.userId);
    if (!d.number) {
      const yr = new Date().getFullYear();
      d.number = `${settings.invoicePrefix}-${yr}-${String(settings.nextInvoiceNumber).padStart(4, '0')}`;
      storage.setSettings(s.userId, { nextInvoiceNumber: settings.nextInvoiceNumber + 1 });
    }
    return data.createInvoice(s.userId, d);
  });

  ipcMain.handle(IPC_CHANNELS.INVOICE_UPDATE, async (_e, d) =>
    data.updateInvoice(session().userId, d.id, d.invoice));

  ipcMain.handle(IPC_CHANNELS.INVOICE_DELETE, async (_e, id) =>
    data.deleteInvoice(session().userId, id));

  ipcMain.handle(IPC_CHANNELS.INVOICE_GET_ALL, async () =>
    data.getAllInvoices(session().userId));

  ipcMain.handle(IPC_CHANNELS.INVOICE_GET, async (_e, id) =>
    data.getInvoice(session().userId, id));

  ipcMain.handle(IPC_CHANNELS.INVOICE_DUPLICATE, async (_e, id) =>
    data.duplicateInvoice(session().userId, id));

  ipcMain.handle(IPC_CHANNELS.INVOICE_UPDATE_STATUS, async (_e, d) =>
    data.updateInvoiceStatus(session().userId, d.id, d.status));

  // ─── Client ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.CLIENT_CREATE, async (_e, d) =>
    data.createClient(session().userId, d));

  ipcMain.handle(IPC_CHANNELS.CLIENT_UPDATE, async (_e, d) =>
    data.updateClient(session().userId, d.id, d.client));

  ipcMain.handle(IPC_CHANNELS.CLIENT_DELETE, async (_e, id) =>
    data.deleteClient(session().userId, id));

  ipcMain.handle(IPC_CHANNELS.CLIENT_GET_ALL, async () =>
    data.getAllClients(session().userId));

  // ─── PDF ───────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.PDF_EXPORT, async (_e, d) => {
    try {
      const s = session();
      const ir = data.getInvoice(s.userId, d.invoiceId);
      if (!ir.success || !ir.data) return { success: false, error: 'Invoice not found' };
      const settings = storage.getSettings(s.userId);
      const html = generateInvoiceHtml(ir.data, settings);
      const { filePath } = await dialog.showSaveDialog({
        title: 'Save Invoice PDF',
        defaultPath: `${ir.data.number || 'invoice'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!filePath) return { success: false, error: 'Cancelled' };
      const pw = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
      await pw.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const buf = await pw.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
      pw.close();
      fs.writeFileSync(filePath, buf);
      return { success: true, data: filePath };
    } catch (err) {
      log.error('PDF export:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PDF_EXPORT_BATCH, async (_e, d) => {
    try {
      const s = session();
      const settings = storage.getSettings(s.userId);
      const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Select folder for PDFs' });
      if (!filePaths?.length) return { success: false, error: 'Cancelled' };
      const outDir = filePaths[0];
      for (const id of (d.invoiceIds as string[])) {
        const ir = data.getInvoice(s.userId, id);
        if (!ir.success || !ir.data) continue;
        const html = generateInvoiceHtml(ir.data, settings);
        const pw = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
        await pw.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const buf = await pw.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
        pw.close();
        fs.writeFileSync(path.join(outDir, `${ir.data.number || id}.pdf`), buf);
      }
      return { success: true, data: outDir };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PDF_PRINT, async () => {
    getMainWindow()?.webContents.send('app:shortcut', 'print');
    return { success: true };
  });

  // ─── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    try { return { success: true, data: storage.getSettings(session().userId) }; }
    catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_e, d) => {
    try { return { success: true, data: storage.setSettings(session().userId, d) }; }
    catch (e) { return { success: false, error: String(e) }; }
  });

  // ─── Shell ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_e, url: string) => shell.openExternal(url));
  ipcMain.handle(IPC_CHANNELS.SHELL_SHOW_IN_FOLDER, async (_e, p: string) => shell.showItemInFolder(p));

  // ─── Backup ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT, async () => {
    try {
      const s = session();
      const { filePath } = await dialog.showSaveDialog({
        title: 'Export Backup',
        defaultPath: `finch-backup-${new Date().toISOString().split('T')[0]}.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!filePath) return { success: false, error: 'Cancelled' };
      const srcDir = path.join(app.getPath('userData'), 'users', s.userId);
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(filePath);
        const arc = archiver('zip', { zlib: { level: 9 } });
        arc.on('error', reject);
        out.on('close', resolve);
        arc.pipe(out);
        arc.directory(srcDir, false);
        arc.finalize();
      });
      return { success: true, data: filePath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_IMPORT, async () => {
    return { success: false, error: 'Import from backup: extract the ZIP to your user data folder manually.' };
  });

  // ─── CSV ───────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.CSV_SAVE, async (_e, d: { csv: string; defaultName: string }) => {
    let filePath: string | undefined;
    try {
      const result = await dialog.showSaveDialog({
        title: 'Save CSV',
        defaultPath: d.defaultName,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };
      filePath = result.filePath;
      await fs.promises.writeFile(filePath, d.csv, 'utf-8');
      return { success: true, data: filePath };
    } catch (err) {
      if (filePath) {
        try { await fs.promises.unlink(filePath); } catch { /* ignore */ }
      }
      return { success: false, error: String(err) };
    }
  });

  log.info('IPC handlers registered');
}
