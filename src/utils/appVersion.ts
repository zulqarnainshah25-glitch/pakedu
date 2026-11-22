import { parseJsonResponseText } from './apiResponse';

export const PORTAL_APP_NAME = 'PakEdu & Sindh SELD Official Portal';
export const PORTAL_VERSION = '1.0.6';
export const PORTAL_LAST_UPDATED = '2026-11-20';

export interface PortalVersionInfo {
  appName: string;
  version: string;
  lastUpdated: string;
  modules: string[];
}

export async function fetchPortalVersion(): Promise<PortalVersionInfo> {
  try {
    const res = await fetch('/api/version', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const rawText = await res.text();
    const parsed = parseJsonResponseText<Partial<PortalVersionInfo>>(
      rawText,
      res.status,
      res.headers.get('content-type')
    );
    if (!res.ok || !parsed.ok || !parsed.data) {
      throw new Error(parsed.error || `HTTP ${res.status}`);
    }
    const data = parsed.data;
    return {
      appName: typeof data.appName === 'string' ? data.appName : PORTAL_APP_NAME,
      version: typeof data.version === 'string' ? data.version : PORTAL_VERSION,
      lastUpdated:
        typeof data.lastUpdated === 'string' ? data.lastUpdated : PORTAL_LAST_UPDATED,
      modules: Array.isArray(data.modules) ? data.modules : [],
    };
  } catch {
    return {
      appName: PORTAL_APP_NAME,
      version: PORTAL_VERSION,
      lastUpdated: PORTAL_LAST_UPDATED,
      modules: [
        'AI Lesson Plan Generator',
        'Sindh Salary Calculator 2026',
        'SELD FRAMES Leave Proforma',
        'AtlierCV Studio',
        'Service Book Calculator',
        'AI Question Paper Maker',
      ],
    };
  }
}
