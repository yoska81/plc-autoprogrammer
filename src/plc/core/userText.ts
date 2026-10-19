/** Operands the app writes (CLICK's address model): X001, Y002, C21, DS1003, TD1, CTD1. */
export const APP_OPERAND = /\b(CTD|TD|CT|DS|DD|DH|DF|SC|C|T|X|Y)(\d+)\b/g;

/**
 * Rename the app operands of a generated text, but never inside the user's own texts it quotes ("Pusher extended
 * (cylinder C1, tank T1)" keeps its C1 and T1): only the operands the app itself wrote around them change.
 */
export function outsideUserText(text: string, users: string[], fn: (operand: string) => string, re: RegExp = APP_OPERAND): string {
  const mine = new Uint8Array(text.length);
  for (const u of users) if (u) for (let i = text.indexOf(u); i >= 0; i = text.indexOf(u, i + u.length)) mine.fill(1, i, i + u.length);
  return text.replace(new RegExp(re.source, 'g'), (m: string, ...rest: unknown[]) => {
    const at = rest.find((x) => typeof x === 'number') as number;
    return mine[at] ? m : fn(m);
  });
}
