/**
 * Shared constants for the web client.
 * Keep this file minimal — only values shared across multiple components.
 */

// ─── CDN / Asset URLs ───────────────────────────────────────────────
export const CDN_BASE = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.amux.ai';
export const VIDEO_DEMO_CDN = `${CDN_BASE}/playground/video/video/demo`;

// ─── UI ─────────────────────────────────────────────────────────────
export const COPY_TOAST_DURATION_MS = 2000;
export const MEGA_MENU_CLOSE_DELAY_MS = 150;
