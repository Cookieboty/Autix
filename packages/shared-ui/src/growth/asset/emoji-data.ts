/**
 * 精选 emoji 表（字符 + 检索关键词）。
 *
 * 为什么不引 emoji-picker-react / emoji-mart：它们要拖进一份完整 Unicode 数据集
 * （~1MB+ 的 JSON，且随 Unicode 版本更新），而这里的用途只是给文件夹挑个图标。
 * 一张够用的精选表既省体积、又不引入需要跟着升级的第三方数据。
 *
 * keywords 全小写；搜索按「关键词前缀」匹配，不做模糊，避免搜 "a" 出来一整屏。
 */

export interface EmojiEntry {
  char: string;
  keywords: string[];
}

export const EMOJI_GROUPS: Array<{ key: string; emojis: EmojiEntry[] }> = [
  {
    key: 'smileys',
    emojis: [
      { char: '😀', keywords: ['grin', 'smile', 'happy'] },
      { char: '😃', keywords: ['smile', 'happy'] },
      { char: '😄', keywords: ['smile', 'laugh'] },
      { char: '😁', keywords: ['beam', 'grin'] },
      { char: '😆', keywords: ['laugh', 'satisfied'] },
      { char: '😅', keywords: ['sweat', 'laugh'] },
      { char: '🤣', keywords: ['rofl', 'laugh'] },
      { char: '😂', keywords: ['joy', 'tears', 'laugh'] },
      { char: '🙂', keywords: ['slight', 'smile'] },
      { char: '🙃', keywords: ['upside', 'silly'] },
      { char: '😉', keywords: ['wink'] },
      { char: '😊', keywords: ['blush', 'smile'] },
      { char: '😇', keywords: ['halo', 'angel'] },
      { char: '🥰', keywords: ['love', 'hearts'] },
      { char: '😍', keywords: ['heart', 'eyes', 'love'] },
      { char: '🤩', keywords: ['star', 'struck'] },
      { char: '😘', keywords: ['kiss'] },
      { char: '😜', keywords: ['tongue', 'wink'] },
      { char: '🤪', keywords: ['zany', 'crazy'] },
      { char: '🤔', keywords: ['think'] },
      { char: '🤫', keywords: ['shush', 'quiet'] },
      { char: '😎', keywords: ['cool', 'sunglasses'] },
      { char: '🥳', keywords: ['party', 'celebrate'] },
      { char: '😱', keywords: ['scream', 'shock'] },
    ],
  },
  {
    key: 'objects',
    emojis: [
      { char: '📁', keywords: ['folder', 'file'] },
      { char: '📂', keywords: ['folder', 'open'] },
      { char: '🗂️', keywords: ['dividers', 'folder', 'card'] },
      { char: '📌', keywords: ['pin'] },
      { char: '📎', keywords: ['clip'] },
      { char: '🔖', keywords: ['bookmark', 'tag'] },
      { char: '📷', keywords: ['camera', 'photo'] },
      { char: '🎬', keywords: ['clapper', 'movie', 'video'] },
      { char: '🎨', keywords: ['art', 'palette', 'paint'] },
      { char: '🖼️', keywords: ['picture', 'frame', 'image'] },
      { char: '✏️', keywords: ['pencil', 'edit'] },
      { char: '💡', keywords: ['idea', 'bulb', 'light'] },
      { char: '🔍', keywords: ['search', 'magnify'] },
      { char: '⚙️', keywords: ['gear', 'settings'] },
      { char: '🎵', keywords: ['music', 'note', 'audio'] },
      { char: '🎯', keywords: ['target', 'goal', 'dart'] },
      { char: '🏆', keywords: ['trophy', 'win'] },
      { char: '💎', keywords: ['gem', 'diamond'] },
      { char: '🔒', keywords: ['lock', 'private'] },
      { char: '📦', keywords: ['box', 'package', 'archive'] },
    ],
  },
  {
    key: 'symbols',
    emojis: [
      { char: '❤️', keywords: ['heart', 'red', 'love'] },
      { char: '🧡', keywords: ['heart', 'orange'] },
      { char: '💛', keywords: ['heart', 'yellow'] },
      { char: '💚', keywords: ['heart', 'green'] },
      { char: '💙', keywords: ['heart', 'blue'] },
      { char: '💜', keywords: ['heart', 'purple'] },
      { char: '🔥', keywords: ['fire', 'hot', 'lit'] },
      { char: '⭐', keywords: ['star'] },
      { char: '✨', keywords: ['sparkles', 'magic', 'ai'] },
      { char: '⚡', keywords: ['zap', 'bolt', 'fast'] },
      { char: '🌈', keywords: ['rainbow'] },
      { char: '🌙', keywords: ['moon', 'night'] },
      { char: '☀️', keywords: ['sun', 'day'] },
      { char: '🌊', keywords: ['wave', 'water', 'ocean'] },
      { char: '🍀', keywords: ['clover', 'luck'] },
      { char: '🌸', keywords: ['blossom', 'flower'] },
      { char: '🚀', keywords: ['rocket', 'launch', 'ship'] },
      { char: '🎉', keywords: ['party', 'tada'] },
      { char: '👀', keywords: ['eyes', 'look'] },
      { char: '🧠', keywords: ['brain', 'think'] },
    ],
  },
];

const ALL: EmojiEntry[] = EMOJI_GROUPS.flatMap((group) => group.emojis);

/** 空查询返回全部；否则按关键词**前缀**匹配。 */
export function searchEmoji(query: string): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL;
  return ALL.filter((entry) => entry.keywords.some((keyword) => keyword.startsWith(q)));
}
