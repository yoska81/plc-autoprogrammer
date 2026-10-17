/** Pure helpers for dictation and read-aloud (no browser APIs, unit-tested in text.test.ts). */
import type { DictateMode, SpeechEngine } from './useVoiceSettings';

/** "he-IL" → "he" (what the transcription services take). */
export const langCode = (lang: string): string => (lang.split('-')[0] || 'en').toLowerCase();

/** Put dictated words into the text that was there: at the end (on its own line after a paragraph), or instead of it. */
export function joinDictation(base: string, spoken: string, mode: DictateMode): string {
  const said = spoken.trim();
  if (mode === 'replace') return said;
  if (!said) return base;
  if (!base.trim()) return said;
  if (/\n\s*$/.test(base)) return base.replace(/[ \t]+$/, '') + said;
  return `${base.replace(/\s+$/, '')} ${said}`;
}

/** The engine that will run, from the setting and what this computer offers. */
export function pickEngine(o: { engine: SpeechEngine; browserSpeech: boolean; desktop: boolean; openaiKey: boolean; preview: boolean }): Exclude<SpeechEngine, 'auto'> {
  // The browser's own recognition is unusable in the desktop app (Chromium there has no speech service).
  const browser = o.browserSpeech && !o.desktop;
  // The preview can only reach the viewer's Claude account: no OpenAI calls.
  const openai = o.openaiKey && !o.preview;
  if (o.engine === 'browser' && browser) return 'browser';
  if (o.engine === 'openai' && openai) return 'openai';
  if (o.engine === 'local') return 'local';
  if (browser) return 'browser';
  if (openai) return 'openai';
  return 'local';
}

/** Whole words (works for Hebrew and Cyrillic too, where \b does not). */
const words = (alts: string) => new RegExp(`(^|[\\s,.!?;:"'«»])(${alts})(?=$|[\\s,.!?;:"'«»])`, 'iu');

const YES: Record<string, RegExp> = {
  en: words('yes|yeah|yep|save|save it|correct|right|ok|okay|confirm'),
  he: words('כן|שמור|נכון|בסדר|אוקיי'),
  ru: words('да|сохрани|сохранить|верно|правильно|хорошо|ок'),
  es: words('sí|si|guarda|guardar|guárdalo|correcto|vale|de acuerdo|ok'),
  fr: words('oui|enregistre|enregistrer|correct|d\'accord|ok'),
  de: words('ja|speichern|richtig|genau|ok|okay'),
  it: words('sì|si|salva|corretto|va bene|ok'),
  pt: words('sim|salvar|salva|correto|certo|ok'),
};
const NO: Record<string, RegExp> = {
  en: words('no|nope|again|retry|wrong|redo'),
  he: words('לא|שוב|עוד פעם|טעות'),
  ru: words('нет|снова|ещё раз|еще раз|неверно'),
  es: words('no|otra vez|de nuevo|repetir|incorrecto'),
  fr: words('non|encore|recommence|recommencer|faux'),
  de: words('nein|nochmal|noch einmal|falsch'),
  it: words('no|ancora|di nuovo|sbagliato'),
  pt: words('não|nao|de novo|outra vez|errado'),
};
const SKIP: Record<string, RegExp> = {
  en: words('skip|next|later|pass'),
  he: words('דלג|הבא|אחר כך'),
  ru: words('пропусти|пропустить|дальше|следующий|потом'),
  es: words('salta|saltar|siguiente|después|despues'),
  fr: words('passe|passer|suivant|plus tard'),
  de: words('überspringen|uberspringen|weiter|nächste|später'),
  it: words('salta|prossimo|prossima|dopo'),
  pt: words('pular|pula|próximo|proximo|depois'),
};
const STOP: Record<string, RegExp> = {
  en: words('stop|finish|end|quit|cancel'),
  he: words('עצור|סיים|די|בטל'),
  ru: words('стоп|хватит|закончить|отмена'),
  es: words('parar|basta|terminar|cancelar'),
  fr: words('stop|arrête|arrêter|terminer|annuler'),
  de: words('stopp|stop|beenden|abbrechen|ende'),
  it: words('stop|basta|ferma|fine|annulla'),
  pt: words('parar|chega|terminar|cancelar'),
};

/** A spoken reply to "Save it?": save, again, skip, stop, or not understood. */
export function spokenReply(text: string, lang: string): 'yes' | 'no' | 'skip' | 'stop' | null {
  const t = text.trim();
  if (!t) return null;
  const l = langCode(lang);
  const test = (m: Record<string, RegExp>) => (m[l] ?? m.en).test(t) || (l !== 'en' && m.en.test(t));
  // Order matters: "no, stop" is stop; "yes" inside a longer answer still counts.
  if (test(STOP)) return 'stop';
  if (test(SKIP)) return 'skip';
  if (test(NO)) return 'no';
  if (test(YES)) return 'yes';
  return null;
}

/** Text as it should be read aloud: no Markdown marks, tables read row by row. */
export function speakable(text: string): string {
  return text
    .split('\n')
    .filter((l) => !/^\s*\|?\s*:?-{3,}/.test(l)) // table rule lines
    .map((l) => l
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/^\s*[-*•]\s+/, '')
      .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
      .replace(/\s*\|\s*/g, ', ')
      .replace(/\*\*|__|`/g, '')
      .replace(/(^|\s)[_*]([^_*]+)[_*](?=\s|$|[.,;:])/g, '$1$2')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim())
    .filter(Boolean)
    .join('.\n')
    .replace(/([.!?:;])\.\n/g, '$1\n');
}

/**
 * Split a long text into pieces speechSynthesis reads reliably (Chromium stops long utterances
 * after ~15 s): sentences joined up to `max` characters.
 */
export function speechChunks(text: string, max = 220): string[] {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (cur && (cur + p).length > max) { out.push(cur.trim()); cur = ''; }
    if (p.length > max) {
      // A very long sentence: split at commas, then at spaces.
      for (const w of p.split(/(?<=,)\s+|\s+/)) {
        if (cur && (cur + ' ' + w).length > max) { out.push(cur.trim()); cur = ''; }
        cur += (cur ? ' ' : '') + w;
      }
    } else cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Recording time as m:ss. */
export const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
