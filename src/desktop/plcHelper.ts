/**
 * "Send to PLC software" from the web page (the claude.ai artifact): the ISA PLC Helper on this PC
 * (electron/plcHelper.cjs), a local MCP server the Claude desktop app runs, reached through the artifact
 * runtime's mcp capability as `host:isa_plc_helper`. The adapter gives the four Send dialogs the same bridges
 * as the desktop app (src/desktop/bridge.ts): a bridge command runs on the helper as a job, and its progress
 * and its end come back by polling the job's status.
 *
 * Outside the Claude desktop app (a browser tab) or without the helper, the calls fail with
 * `server_not_connected`, and the page says what to do instead (src/plc/ui/SendToPlc.tsx).
 */
import { useSyncExternalStore } from 'react';
import { desktopBridge, type ClickBridge, type CodesysBridge, type Studio5000Bridge, type TiaBridge } from './bridge';

export const HELPER_SERVER = 'host:isa_plc_helper';
/** The helper's tools, as the page's manifest names them (tools/preview/README.md). */
export const HELPER_TOOLS = ['about', 'start', 'look', 'status', 'stop', 'logPath', 'showLog'] as const;
/** The commands that only look: the helper's read-only tool, so the Claude app does not ask each time. */
const LOOK: Record<Software, string[]> = { tia: ['detect', 'portals', 'firmware', 'downloadTargets'], click: ['detect'], codesys: ['detect'], studio5000: ['detect', 'info'] };
const POLL_MS = 400;

export type Software = 'tia' | 'click' | 'codesys' | 'studio5000';

/** The artifact runtime's mcp namespace, the part used here. */
export interface McpLike {
  callTool(server: string, tool: string, input?: Record<string, unknown>, options?: { cache?: false }): Promise<{ payload?: unknown }>;
}

export interface PlcBridges { tia: TiaBridge; click: ClickBridge; codesys: CodesysBridge; studio5000: Studio5000Bridge }

/** The page's plain sentence for an mcp rejection. */
export function helperError(err: unknown): Error {
  const e = err as { code?: string; message?: string } | null;
  switch (e?.code) {
    case 'server_not_connected': case 'server_not_found': case 'not_granted': case 'capability_disabled': case 'capability_removed':
      return new Error(NOT_CONNECTED);
    case 'cancelled': return new Error('You said no in the Claude app, so nothing was sent.');
    case 'not_in_manifest': return new Error('This page is not allowed to use the ISA PLC Helper: allow it in the page\'s Permissions menu.');
    case 'tool_error': return new Error(e.message || 'The ISA PLC Helper could not do it.');
    default: return new Error(e?.message || 'The ISA PLC Helper did not answer: try again.');
  }
}

/** The helper's installer (it comes with the ISA Auto Programmer installer). */
export const HELPER_DOWNLOAD_URL = 'https://github.com/yoska81/plc-autoprogrammer/releases/latest';

export const NOT_CONNECTED = 'To send from this page, open it in the Claude desktop app, or install the ISA PLC Helper once.';

/** The four bridges on the helper. `sleep` is the tests' clock. */
export function helperBridges(mcp: McpLike, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): PlcBridges {
  const tool = async <T,>(name: string, input: Record<string, unknown>): Promise<T> => {
    try { return (await mcp.callTool(HELPER_SERVER, name, input, { cache: false })).payload as T; }
    catch (err) { throw helperError(err); }
  };
  function bridge(software: Software) {
    const listeners = new Set<(p: { id: number; text: string }) => void>();
    /** One command as a job: started (or looked), its progress passed on, then its result or its error. */
    async function call(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
      if (cmd === 'stop') return tool('stop', { software });
      const { job } = await tool<{ job: number }>(LOOK[software].includes(cmd) ? 'look' : 'start', { software, cmd, args });
      for (let from = 0; ;) {
        const s = await tool<{ state: string; progress: string[]; next: number; result: unknown; error: string | null }>('status', { job, from });
        for (const text of s.progress) listeners.forEach((cb) => cb({ id: job, text }));
        from = s.next;
        if (s.state === 'done') return s.result;
        if (s.state === 'failed') throw new Error(s.error || 'The ISA PLC Helper could not do it.');
        await sleep(POLL_MS);
      }
    }
    return {
      call: call as never,
      logPath: async () => (await tool<{ path: string }>('logPath', { software })).path,
      showLog: async () => { await tool('showLog', { software }); return true; },
      pickProject: async () => (await call('pickProject')) as string | null,
      onProgress: (cb: (p: { id: number; text: string }) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    };
  }
  return { tia: bridge('tia'), click: bridge('click'), codesys: bridge('codesys'), studio5000: bridge('studio5000') };
}

/** The connection: null until a connect found the helper. */
let helper: PlcBridges | null = null;
const subscribers = new Set<() => void>();
const set = (b: PlcBridges | null) => { helper = b; subscribers.forEach((f) => f()); };

/** The bridges the Send dialogs use: the desktop app's own, else the helper's once connected. */
export function plcBridges(): Partial<PlcBridges> | null {
  return desktopBridge() ?? helper;
}

/** Re-renders when the helper connects. */
export function usePlcBridges(): Partial<PlcBridges> | null {
  useSyncExternalStore((f) => { subscribers.add(f); return () => { subscribers.delete(f); }; }, () => helper);
  return plcBridges();
}

interface ClaudeRuntime { use: (name: string) => Promise<unknown> }

/**
 * Looks for the helper (on a click: its first call is where the Claude app asks the viewer to allow it).
 * Resolves the bridges, or null with the sentence to show.
 */
export async function connectHelper(runtime: ClaudeRuntime | null = (window as unknown as { claude?: ClaudeRuntime }).claude ?? null): Promise<{ bridges: PlcBridges } | { error: string }> {
  const mcp = (await runtime?.use('mcp').catch(() => null)) as McpLike | null | undefined;
  if (!mcp) return { error: NOT_CONNECTED };
  try {
    await mcp.callTool(HELPER_SERVER, 'about', {}, { cache: false });
  } catch (err) {
    return { error: helperError(err).message };
  }
  const bridges = helperBridges(mcp);
  set(bridges);
  return { bridges };
}

/** Tests: forget the connection. */
export function resetHelper() { set(null); }
