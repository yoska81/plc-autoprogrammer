/// <reference lib="webworker" />
import { runParse, type ParseRequest } from './parseOps';

// One request at a time; each answer carries the request's id (or the error's message).
self.onmessage = (e: MessageEvent<{ id: number; req: ParseRequest }>) => {
  const { id, req } = e.data;
  try {
    self.postMessage({ id, result: runParse(req) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
