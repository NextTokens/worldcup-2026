/**
 * Shared between the Edge middleware and the Node-side auth module, so it must
 * stay free of node: imports — the middleware bundle cannot load them.
 */
export const SESSION_COOKIE = 'wfd_session';
