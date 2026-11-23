import {
  PORTAL_APP_NAME,
  PORTAL_LAST_UPDATED,
  PORTAL_VERSION,
} from '../src/utils/appVersion';
import { setCorsAndSecurityHeaders } from './_security';

export default function handler(req: any, res: any) {
  if (setCorsAndSecurityHeaders(req, res)) return;

  return res.status(200).json({
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
  });
}
