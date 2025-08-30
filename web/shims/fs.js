// Browser shim for Node's fs; not used in client flow
export function readFileSync(){ throw new Error('fs.readFileSync not available in browser'); }
export function writeFileSync(){ throw new Error('fs.writeFileSync not available in browser'); }
export default { readFileSync, writeFileSync };
