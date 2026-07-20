/**
 * Single source of truth for the Chat system's admin sidebar menus.
 *
 * HISTORY: `seed.ts` and `seed-prod.ts` used to each carry their own literal
 * copy of this list. The two copies drifted — `gallery-review`,
 * `featured-slots` and `resource-boosts` were added to `seed.ts` but never
 * synced to `seed-prod.ts`, and production runs `db:seed:prod` →
 * `seed-prod.ts`, so those three menus silently never appeared in the admin
 * backend until the gap was found and patched. Do not reintroduce a second
 * copy: both scripts must import `CHAT_MENU_DEFS` from here.
 *
 * Sort is grouped by function so new menus have an obvious slot to insert
 * into (bump everything after the insertion point):
 *   1-2   审核       template-review, gallery-review
 *   3-8   会员计费   membership-users .. membership-points
 *   9-11  运营       campaign-rewards, featured-slots, resource-boosts
 *   12    可观测     generation-tasks
 *   13-15 系统       system-models, system-settings, system-prompts
 *
 * `sort` must stay contiguous (1..N, no gaps, no repeats) — the admin
 * sidebar (packages/shared-ui/src/admin/layout/sidebar.tsx) orders purely by
 * this field, and a collision makes the order depend on undefined database
 * return ordering. `validateChatMenuDefs` enforces this at import time so a
 * bad edit throws immediately instead of silently producing flaky ordering.
 */
export type ChatMenuDef = {
  code: string;
  name: string;
  nameEn: string;
  nameZhTW: string;
  nameFr: string;
  nameJa: string;
  nameRu: string;
  nameVi: string;
  path: string;
  icon: string;
  sort: number;
};

/**
 * Validates that `code` values are unique and `sort` values form a
 * contiguous 1..N sequence with no duplicates. Throws on the first
 * violation type it finds (duplicate codes take priority over sort issues)
 * so seed scripts fail fast at import time rather than writing bad data.
 */
export function validateChatMenuDefs(defs: readonly ChatMenuDef[]): void {
  const seenCodes = new Set<string>();
  const dupCodes = new Set<string>();
  for (const def of defs) {
    if (seenCodes.has(def.code)) dupCodes.add(def.code);
    seenCodes.add(def.code);
  }
  if (dupCodes.size > 0) {
    throw new Error(`chat-menus: duplicate code(s): ${[...dupCodes].join(', ')}`);
  }

  const sorts = defs.map((def) => def.sort);
  const seenSorts = new Set<number>();
  const dupSorts = new Set<number>();
  for (const sort of sorts) {
    if (seenSorts.has(sort)) dupSorts.add(sort);
    seenSorts.add(sort);
  }
  if (dupSorts.size > 0) {
    throw new Error(`chat-menus: duplicate sort value(s): ${[...dupSorts].sort((a, b) => a - b).join(', ')}`);
  }

  const sortedSorts = [...sorts].sort((a, b) => a - b);
  for (let i = 0; i < sortedSorts.length; i++) {
    if (sortedSorts[i] !== i + 1) {
      throw new Error(
        `chat-menus: sort values must be contiguous starting at 1 with no gaps, got [${sortedSorts.join(', ')}]`,
      );
    }
  }
}

export const CHAT_MENU_DEFS: readonly ChatMenuDef[] = [
  // ── 审核 (1-2) ──────────────────────────────────────────────────────────
  {
    code: 'template-review',
    name: '模板审核', nameEn: 'Template Review',
    nameZhTW: '模板審核', nameFr: 'Examen des modèles',
    nameJa: 'テンプレート審査', nameRu: 'Проверка шаблонов',
    nameVi: 'Duyệt mẫu',
    path: '/templates', icon: 'FileText', sort: 1,
  },
  {
    code: 'gallery-review',
    name: '广场审核', nameEn: 'Gallery Review',
    nameZhTW: '廣場審核', nameFr: 'Modération de la galerie',
    nameJa: 'ギャラリー審査', nameRu: 'Модерация галереи',
    nameVi: 'Duyệt thư viện',
    path: '/gallery', icon: 'ShieldAlert', sort: 2,
  },
  // ── 会员计费 (3-8) ──────────────────────────────────────────────────────
  {
    code: 'membership-users',
    name: '用户管理', nameEn: 'Membership Users',
    nameZhTW: '使用者管理', nameFr: 'Gestion des membres',
    nameJa: '会員管理', nameRu: 'Управление пользователями',
    nameVi: 'Quản lý thành viên',
    path: '/membership/users', icon: 'Users', sort: 3,
  },
  {
    code: 'membership-levels',
    name: '会员等级', nameEn: 'Membership Levels',
    nameZhTW: '會員等級', nameFr: 'Niveaux de membres',
    nameJa: '会員ランク', nameRu: 'Уровни членства',
    nameVi: 'Cấp thành viên',
    path: '/membership/levels', icon: 'Crown', sort: 4,
  },
  {
    code: 'membership-packages',
    name: '积分加油包', nameEn: 'Credit Packages',
    nameZhTW: '積分加油包', nameFr: 'Packs de crédits',
    nameJa: 'クレジットパック', nameRu: 'Пакеты кредитов',
    nameVi: 'Gói tín dụng',
    path: '/membership/packages', icon: 'Zap', sort: 5,
  },
  {
    code: 'membership-task-costs',
    name: '计费规则', nameEn: 'Pricing Rules',
    nameZhTW: '計費規則', nameFr: 'Règles de tarification',
    nameJa: '課金ルール', nameRu: 'Правила тарификации',
    nameVi: 'Quy tắc tính phí',
    path: '/membership/task-costs', icon: 'Settings', sort: 6,
  },
  {
    code: 'membership-orders',
    name: '订单管理', nameEn: 'Orders',
    nameZhTW: '訂單管理', nameFr: 'Gestion des commandes',
    nameJa: '注文管理', nameRu: 'Управление заказами',
    nameVi: 'Quản lý đơn hàng',
    path: '/membership/orders', icon: 'Receipt', sort: 7,
  },
  {
    code: 'membership-points',
    name: '积分流水', nameEn: 'Points History',
    nameZhTW: '積分流水', nameFr: 'Historique des points',
    nameJa: 'ポイント履歴', nameRu: 'История баллов',
    nameVi: 'Lịch sử điểm',
    path: '/membership/points', icon: 'History', sort: 8,
  },
  // ── 运营 (9-11) ─────────────────────────────────────────────────────────
  {
    code: 'campaign-rewards',
    name: '活动奖励中心', nameEn: 'Campaign Rewards Center',
    nameZhTW: '活動獎勵中心', nameFr: 'Centre des récompenses',
    nameJa: 'キャンペーン報酬センター', nameRu: 'Центр наград кампаний',
    nameVi: 'Trung tâm thưởng chiến dịch',
    path: '/campaigns', icon: 'Gift', sort: 9,
  },
  {
    code: 'featured-slots',
    name: '运营位编排', nameEn: 'Featured Slots',
    nameZhTW: '運營位編排', nameFr: 'Emplacements mis en avant',
    nameJa: '注目枠', nameRu: 'Витрины',
    nameVi: 'Vị trí nổi bật',
    path: '/featured-slots', icon: 'LayoutGrid', sort: 10,
  },
  {
    code: 'resource-boosts',
    name: '内容加热', nameEn: 'Content Boost',
    nameZhTW: '內容加熱', nameFr: 'Boost de contenu',
    nameJa: 'コンテンツブースト', nameRu: 'Продвижение',
    nameVi: 'Tăng nhiệt nội dung',
    path: '/boosts', icon: 'Flame', sort: 11,
  },
  // ── 可观测 (12) ─────────────────────────────────────────────────────────
  {
    code: 'generation-tasks',
    name: '生成任务', nameEn: 'Generation Tasks',
    nameZhTW: '生成任務', nameFr: 'Tâches de génération',
    nameJa: '生成タスク', nameRu: 'Задачи генерации',
    nameVi: 'Tác vụ tạo',
    path: '/generation-tasks', icon: 'ListChecks', sort: 12,
  },
  // ── 系统 (13-15) ────────────────────────────────────────────────────────
  {
    code: 'system-models',
    name: '系统模型配置', nameEn: 'System Models',
    nameZhTW: '系統模型配置', nameFr: 'Modèles système',
    nameJa: 'システムモデル設定', nameRu: 'Системные модели',
    nameVi: 'Cấu hình mô hình hệ thống',
    path: '/models', icon: 'Globe', sort: 13,
  },
  {
    code: 'system-settings',
    name: '系统配置', nameEn: 'System Settings',
    nameZhTW: '系統配置', nameFr: 'Paramètres système',
    nameJa: 'システム設定', nameRu: 'Системные настройки',
    nameVi: 'Cấu hình hệ thống',
    path: '/settings', icon: 'Settings', sort: 14,
  },
  {
    code: 'system-prompts',
    name: '系统 Prompt', nameEn: 'System Prompts',
    nameZhTW: '系統 Prompt', nameFr: 'Prompts système',
    nameJa: 'システムプロンプト', nameRu: 'Системные промпты',
    nameVi: 'Prompt hệ thống',
    path: '/prompts', icon: 'FileText', sort: 15,
  },
];

validateChatMenuDefs(CHAT_MENU_DEFS);
