import { langCode } from './text';

/** OpenAI speech-to-text models, best first; the next is tried when an account can't use one. */
const MODELS = ['gpt-4o-transcribe', 'whisper-1'];

/** Turn recorded speech into text with the user's OpenAI key. */
export async function transcribeOpenAI(audio: Blob, o: { apiKey: string; lang: string; signal?: AbortSignal }): Promise<string> {
  let last: Error | null = null;
  for (const model of MODELS) {
    const form = new FormData();
    form.append('file', audio, `speech.${audio.type.includes('ogg') ? 'ogg' : audio.type.includes('mp4') ? 'mp4' : 'webm'}`);
    form.append('model', model);
    form.append('language', langCode(o.lang));
    form.append('response_format', 'json');
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${o.apiKey}` }, body: form, signal: o.signal,
      });
    } catch (e) {
      if (o.signal?.aborted) throw e;
      throw new Error('Could not reach OpenAI to write down your speech. Check the internet connection.', { cause: e });
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { text?: string };
      return (data.text ?? '').trim();
    }
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
    const msg = body.error?.message ?? '';
    if (res.status === 401) throw new Error('OpenAI did not accept the API key (check it in Settings).');
    if (res.status === 429) throw new Error('OpenAI is busy or the account has no credit left. Try again in a moment.');
    last = new Error(`OpenAI could not write down your speech (${res.status}${msg ? `: ${msg}` : ''}).`);
    // Model not available to this account: try the next one.
    if (res.status === 404 || (res.status === 400 && /model/i.test(msg)) || res.status === 403) continue;
    throw last;
  }
  throw last ?? new Error('OpenAI could not write down your speech.');
}
