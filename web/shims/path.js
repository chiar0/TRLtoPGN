// Minimal subset used by the modules; safe no-ops
export function basename(p){ return String(p||'').split('/').pop() || ''; }
export function extname(p){ const b = basename(p); const i = b.lastIndexOf('.'); return i>=0? b.slice(i) : ''; }
export function dirname(p){ const s = String(p||''); const i = s.lastIndexOf('/'); return i>=0? s.slice(0,i) : ''; }
export default { basename, extname, dirname };
