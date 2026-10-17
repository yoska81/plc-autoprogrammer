/**
 * JSON schema the AI must answer with (Claude structured outputs / OpenAI
 * json_schema). Mirrors the types in ./ladder.ts.
 */

const str = { type: 'string' } as const;
const nullableStr = { type: ['string', 'null'] } as const;

function obj(properties: Record<string, unknown>) {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const element = {
  anyOf: [
    obj({ type: { type: 'string', enum: ['NO', 'NC', 'RISE', 'FALL'] }, address: str }),
    obj({ type: { type: 'string', enum: ['CMP'] }, left: str, op: { type: 'string', enum: ['==', '<>', '>', '>=', '<', '<='] }, right: str }),
  ],
};

const output = {
  anyOf: [
    obj({ type: { type: 'string', enum: ['OUT', 'SET', 'RST'] }, address: str }),
    obj({
      type: { type: 'string', enum: ['TMR'] },
      address: str,
      mode: { type: 'string', enum: ['ON_DELAY', 'OFF_DELAY'] },
      preset: str,
      unit: { type: 'string', enum: ['ms', 'sec', 'min', 'hour', 'day'] },
      accumulate: { type: 'boolean' },
      resetAddress: nullableStr,
    }),
    obj({
      type: { type: 'string', enum: ['CNT'] },
      address: str,
      direction: { type: 'string', enum: ['UP', 'DOWN'] },
      preset: str,
      resetAddress: nullableStr,
    }),
    obj({ type: { type: 'string', enum: ['COPY'] }, source: str, dest: str }),
    obj({ type: { type: 'string', enum: ['MATH'] }, dest: str, expression: str }),
  ],
};

/** One rung (exported for block-sized AI requests, e.g. the cycle block). */
export const RUNG_SCHEMA = obj({
  id: str,
  comment: str,
  /** Block id from program.blocks, or "" for none. */
  block: str,
  branches: { type: 'array', items: { type: 'array', items: element } },
  outputs: { type: 'array', items: output },
});

const program = obj({
  blocks: { type: 'array', items: obj({ id: str, name: str, description: str }) },
  rungs: { type: 'array', items: RUNG_SCHEMA },
  tags: { type: 'array', items: obj({ address: str, nickname: str, comment: str }) },
});

/** Response shape for both "generate" and "fix" requests. */
export const LADDER_RESPONSE_SCHEMA = obj({
  explanation: str,
  program: { anyOf: [program, { type: 'null' }] },
});
