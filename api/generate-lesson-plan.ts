import { generateLessonPlanWithGemini } from '../src/utils/geminiCore';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const board = String(payload.board || 'Sindh Textbook Board (STBB)').slice(0, 80);
    const section = String(payload.section || 'Primary').slice(0, 40);
    const className = String(payload.className || 'Class 5').slice(0, 30);
    const subject = String(payload.subject || 'General Science').slice(0, 60);
    const chapter = String(payload.chapter || 'Chapter 1').slice(0, 100);
    const topic = String(payload.topic || 'Introduction').slice(0, 120);
    const duration = String(payload.duration || '40 Minutes').slice(0, 30);
    const planType = String(payload.planType || 'Daily').slice(0, 20);

    const plan = await generateLessonPlanWithGemini({
      board,
      section,
      className,
      subject,
      chapter,
      topic,
      duration,
      planType,
    }, process.env.GEMINI_API_KEY);

    return res.status(200).json({
      source: 'gemini-ai',
      plan,
    });
  } catch (error: any) {
    console.error('Vercel generate-lesson-plan error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate lesson plan.',
    });
  }
}
