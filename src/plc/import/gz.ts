/**
 * The original program file is kept with the project (to write changes back into it), gzip-compressed
 * as base64 so it fits the project's saved data. Browser and node both have CompressionStream.
 */

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function gzipText(text: string): Promise<string> {
  const bytes = await pipe(new TextEncoder().encode(text), new CompressionStream('gzip'));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function gunzipText(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')));
}
