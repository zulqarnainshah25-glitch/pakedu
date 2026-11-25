export interface ElectronSaveFileResult {
  canceled: boolean;
  filePath?: string;
  error?: string;
}

export interface ElectronPrintResult {
  success: boolean;
  error?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  saveFile: (payload: {
    data: Uint8Array;
    fileName: string;
    mimeType?: string;
  }) => Promise<ElectronSaveFileResult>;
  printDocument: (options?: {
    silent?: boolean;
    printBackground?: boolean;
  }) => Promise<ElectronPrintResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
