import { handleCvBuild } from '../src/utils/cvBuilderApi';
import { getEffectiveGeminiApiKey } from '../src/utils/envConfig';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const rawCV = rawBody.cv;
    if (!rawCV) {
      return res.status(400).json({ error: 'Missing CV data in request body.' });
    }

    const apiKey = getEffectiveGeminiApiKey(process.env.GEMINI_API_KEY);
    const result = await handleCvBuild(rawCV, apiKey, 'gemini-3.5-flash-lite');
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vercel build-cv error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to process CV.' });
  }
}
