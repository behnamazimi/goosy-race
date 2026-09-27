// Which private room this page belongs to: /r/KQ7PZ (phones) or /r/KQ7PZ/tv (big screen).
const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{5})(?:\/|$)/);
export const ROOM = m ? m[1].toUpperCase() : null;
export const fmtCode = (c) => (c ? `${c.slice(0, 3)}-${c.slice(3)}` : '');
export const roomUrl = (c = ROOM) => `${location.origin}/r/${c}`;
export const normCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Live-format a code input as KQ7-PZ while typing.
export function bindCodeInput(input) {
  input.addEventListener('input', () => {
    const c = normCode(input.value).slice(0, 5);
    input.value = c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
  });
}
// Create a fresh room and go to it (used by the landing page and by dead-room pages).
export async function createAndGo(tv = false) {
  const r = await fetch('/api/rooms', { method: 'POST' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return r.status;
  location.href = `/r/${j.code}${tv ? '/tv' : '?new=1'}`;
  return 0;
}
