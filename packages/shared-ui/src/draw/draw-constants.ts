export const SAVE_DEBOUNCE_MS = 1200;
export const TITLE_SAVE_DEBOUNCE_MS = 900;
export const DEFAULT_IMAGE_SIZE = 320;
export const DEFAULT_STROKE_COLOR = '#111827';
export const VIDEO_NODE_WIDTH = 460;
export const VIDEO_NODE_HEIGHT = 300;
// The Excalidraw node element is an invisible 300px anchor, but the rendered
// overlay panel is content-driven and much taller (thumbnails + shot ribbon +
// prompt + model row). Auto-layout must reserve the panel's real footprint.
export const VIDEO_NODE_PANEL_HEIGHT = 540;
export const DRAW_UPLOAD_FOLDER = 'amux-studio/draw-uploads';
export const DRAW_COLOR_SWATCHES = [
  '#111827',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
];
export const GENERIC_CONVERSATION_TITLES = new Set(['新绘制对话', 'New Conversation', 'Untitled', '绘制对话']);

export const HIDE_EXCALIDRAW_UI = `
.draw-canvas .App-menu__left,
.draw-canvas .App-toolbar,
.draw-canvas .layer-ui__wrapper__top-right,
.draw-canvas .footer-center,
.draw-canvas .App-menu_top__left,
.draw-canvas .zoom-actions,
.draw-canvas .undo-redo-buttons,
.draw-canvas .help-icon { display: none !important; }
.draw-canvas .Island { box-shadow: none; }
.draw-canvas .excalidraw { --color-primary: #ffffff; --color-primary-darker: #d4d4d4; }
.draw-canvas .excalidraw .popover,
.draw-canvas .excalidraw .context-menu { z-index: 1000 !important; }
`;
