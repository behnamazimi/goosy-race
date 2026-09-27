// Which private room this page belongs to: /r/KQ7PZ (phones) or /r/KQ7PZ/tv (big screen).
const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{5})(?:\/|$)/);
export const ROOM = m ? m[1].toUpperCase() : null;
export const fmtCode = (c) => (c ? `${c.slice(0, 3)}-${c.slice(3)}` : '');
export const roomUrl = (c = ROOM) => `${location.origin}/r/${c}`;
