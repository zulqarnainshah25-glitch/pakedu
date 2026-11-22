import { generateQuestionPaperWithGemini } from '../src/utils/geminiCore';
import { validateQuestionPaperRequest } from '../src/utils/questionPaperLogic';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const validation = validateQuestionPaperRequest(rawBody);

    if (!validation.valid || !validation.sanitized) {
      return res.status(400).json({
        error: validation.error || 'Invalid question paper parameters.',
      });
    }

    const paper = await generateQuestionPaperWithGemini(
      validation.sanitized,
      process.env.GEMINI_API_KEY
    );

    return res.status(200).json({
      source: 'gemini-ai',
      paper,
    });
  } catch (error: any) {
    console.error('Vercel generate-question-paper error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate question paper.',
    });
  }
}
