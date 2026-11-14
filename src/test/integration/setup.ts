// supabase-js builds a Realtime client eagerly, and on Node < 22 it refuses to
// start without a global WebSocket. Next.js provides one at runtime; these
// tests never open a socket, so a placeholder is enough.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class {
    constructor() {
      throw new Error('WebSocket is not available in the integration tests');
    }
  } as unknown as typeof WebSocket;
}
