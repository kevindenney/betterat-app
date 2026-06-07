/**
 * Voice note transcription via Google Gemini API.
 * Telegram voice notes are .oga (Ogg Opus) — Gemini accepts audio natively.
 * Uses the same GOOGLE_AI_API_KEY already configured for the app.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Transcribe a voice note audio buffer to text using Gemini.
 * Returns the transcribed text, or null on failure.
 */
export async function transcribeVoiceNote(
  audioBuffer: Buffer,
  mimeType: string = 'audio/ogg',
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No Gemini key (GOOGLE_AI_API_KEY / EXPO_PUBLIC_GEMINI_API_KEY) configured — cannot transcribe voice notes');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const base64Audio = audioBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
      {
        text: 'Transcribe this voice note exactly. Return ONLY the transcribed text, nothing else. No labels, no quotes, no explanation.',
      },
    ]);

    const text = result.response.text()?.trim();
    return text || null;
  } catch (error) {
    console.error('Voice transcription error:', error);
    return null;
  }
}
