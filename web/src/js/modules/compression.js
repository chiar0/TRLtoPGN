// Share encoding/decoding functionality
export function bytesToB64url(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    bin += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function b64urlEncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecodeUtf8(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function gzipCompressString(str) {
  if (!('CompressionStream' in window)) return null;
  const enc = new TextEncoder().encode(str);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(enc);
  writer.close();
  const resp = new Response(cs.readable);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

export async function gzipDecompressToString(bytes) {
  if ('DecompressionStream' in window) {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const resp = new Response(ds.readable);
    const buf = await resp.arrayBuffer();
    return new TextDecoder().decode(buf);
  }
  // Fallback via pako (ESM). Only loaded if needed.
  try {
    const pako = await import('pako');
    const out = pako.ungzip(bytes, { to: 'string' });
    return typeof out === 'string' ? out : new TextDecoder().decode(out);
  } catch (e) {
    throw new Error('no-decompress');
  }
}

export async function deflateCompressString(str) {
  if (!('CompressionStream' in window)) return null;
  const enc = new TextEncoder().encode(str);
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(enc);
  writer.close();
  const resp = new Response(cs.readable);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

export async function deflateDecompressToString(bytes) {
  if ('DecompressionStream' in window) {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const resp = new Response(ds.readable);
    const buf = await resp.arrayBuffer();
    return new TextDecoder().decode(buf);
  }
  try {
    const pako = await import('pako');
    const out = pako.inflate(bytes, { to: 'string' });
    return typeof out === 'string' ? out : new TextDecoder().decode(out);
  } catch (e) {
    throw new Error('no-decompress');
  }
}