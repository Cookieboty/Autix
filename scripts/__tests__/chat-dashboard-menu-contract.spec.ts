import { describe, expect, it } from 'vitest';
import { CHAT_QUICK_ACTIONS } from '../../packages/shared-ui/src/admin/dashboard/chat/chat-dashboard.helpers';
import { CHAT_MENU_DEFS } from '../../packages/database/prisma/seeds/chat-menus';

describe('Chat dashboard quick action menu contract', () => {
  it('maps all eight unique action menu codes to real Chat menu paths', () => {
    expect(CHAT_QUICK_ACTIONS).toHaveLength(8);
    expect(new Set(CHAT_QUICK_ACTIONS.map((action) => action.menuCode)).size).toBe(8);
    for (const action of CHAT_QUICK_ACTIONS) {
      const menu = CHAT_MENU_DEFS.find((item) => item.code === action.menuCode);
      expect(menu, action.menuCode).toBeDefined();
      expect(action.path).toBe(`/admin${menu?.path}`);
    }
    expect(CHAT_QUICK_ACTIONS.filter((action) => action.badgeSource)).toHaveLength(3);
    expect(CHAT_QUICK_ACTIONS.find((action) => action.menuCode === 'resource-boosts')?.path).toBe('/admin/boosts');
  });
});
