import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_SARVAM_KEY = 'sk_bg0be0ki_WfSCVNBgxmlTHiS3VmMfhLAA';

export class SarvamSTTClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.SARVAM_API_KEY || DEFAULT_SARVAM_KEY;
  }

  /**
   * Transcribes raw audio buffer (e.g. wav/webm/mp3) using Sarvam Saaras STT
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<{ transcript: string; duration_ms: number; language_code?: string }> {
    const t0 = performance.now();
    try {
      const apiKey = process.env.SARVAM_API_KEY || DEFAULT_SARVAM_KEY;
      
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType });
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'saaras:v1');
      formData.append('language_code', 'en-IN');
      formData.append('with_diarization', 'false');

      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Sarvam STT API returned ${response.status}:`, errorText);
        throw new Error(`Sarvam STT failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      const transcript = result.transcript || result.text || '';
      const durationMs = performance.now() - t0;

      return {
        transcript: transcript.trim(),
        duration_ms: Math.round(durationMs),
        language_code: result.language_code || 'en-IN'
      };
    } catch (err: any) {
      console.warn('Sarvam API STT error:', err.message);
      throw err;
    }
  }
}
