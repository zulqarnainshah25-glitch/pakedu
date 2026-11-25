import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = 'http://localhost:3000';
const PROD_INDEX_PATH = path.join(__dirname, '../dist/index.html');
const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');

const isDev =
  !app.isPackaged &&
  (process.argv.includes('--dev') ||
    process.env.ELECTRON_DEV === 'true' ||
    process.env.NODE_ENV === 'development');

const FILE_FILTER_MAP = [
  { extensions: ['pdf'], mimeTypes: ['application/pdf'], name: 'PDF Document' },
  { extensions: ['csv'], mimeTypes: ['text/csv'], name: 'CSV Spreadsheet' },
  {
    extensions: ['docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    name: 'Word Document',
  },
  { extensions: ['png'], mimeTypes: ['image/png'], name: 'PNG Image' },
];

let mainWindow = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probeServer(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => {
      resolve(false);
    });
  });
}

async function waitForDevServer(url, maxAttempts = 40, intervalMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await probeServer(url)) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

function isAuthPopupUrl(rawUrl) {
  if (!rawUrl || rawUrl === 'about:blank') {
    return true;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'accounts.google.com' ||
      host === 'apis.google.com' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.firebaseapp.com') ||
      host.endsWith('.web.app') ||
      parsed.pathname.startsWith('/__/auth/')
    );
  } catch {
    return false;
  }
}

function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function isAllowedMainNavigation(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (isDev) {
      return parsed.origin === DEV_SERVER_URL;
    }
    return parsed.protocol === 'file:';
  } catch {
    return false;
  }
}

function sanitizeFileName(rawName) {
  const base = path.basename(typeof rawName === 'string' ? rawName : 'document');
  const cleaned = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'document';
  }
  return cleaned;
}

function buildSaveFilters(fileName, mimeType) {
  const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
  const normalizedMime =
    typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : '';
  const matched = FILE_FILTER_MAP.find(
    (entry) =>
      (ext && entry.extensions.includes(ext)) ||
      (normalizedMime && entry.mimeTypes.includes(normalizedMime))
  );

  const filters = [];
  if (matched) {
    filters.push({ name: matched.name, extensions: matched.extensions });
  } else if (ext) {
    filters.push({ name: `${ext.toUpperCase()} File`, extensions: [ext] });
  }
  filters.push({ name: 'All Files', extensions: ['*'] });
  return filters;
}

function toBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Array.isArray(data)) return Buffer.from(data);
  throw new TypeError('Unsupported binary data payload for save-file');
}

function registerIpcHandlers() {
  ipcMain.handle('save-file', async (event, payload = {}) => {
    try {
      const ownerWindow = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
      const safeFileName = sanitizeFileName(payload?.fileName);
      const dialogOptions = {
        title: 'Save File',
        defaultPath: path.join(app.getPath('documents'), safeFileName),
        filters: buildSaveFilters(safeFileName, payload?.mimeType),
      };

      const result = ownerWindow
        ? await dialog.showSaveDialog(ownerWindow, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const buffer = toBuffer(payload?.data);
      await fs.writeFile(result.filePath, buffer);
      return { canceled: false, filePath: result.filePath };
    } catch (err) {
      return {
        canceled: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('print-document', async (event, options = {}) => {
    return new Promise((resolve) => {
      try {
        event.sender.print(
          {
            silent: Boolean(options?.silent),
            printBackground: options?.printBackground !== false,
          },
          (success, failureReason) => {
            resolve({
              success,
              ...(failureReason ? { error: failureReason } : {}),
            });
          }
        );
      } catch (err) {
        resolve({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'PakEdu Portal',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: PRELOAD_PATH,
    },
  });

  mainWindow = win;
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
    }
  });
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          autoHideMenuBar: true,
          parent: win,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('Failed to open external URL:', err);
      });
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isAllowedMainNavigation(url)) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('Failed to open navigated external URL:', err);
      });
    }
  });

  win.webContents.on('did-fail-load', () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
    }
  });

  if (isDev) {
    const ready = await waitForDevServer(DEV_SERVER_URL);
    if (!ready) {
      console.warn(`Dev server ${DEV_SERVER_URL} did not respond in time; attempting load anyway.`);
    }
    await win.loadURL(DEV_SERVER_URL);
  } else {
    await win.loadFile(PROD_INDEX_PATH);
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
