import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHAT_MENU_DEFS, validateChatMenuDefs, type ChatMenuDef } from '../prisma/seeds/chat-menus';

const seedSources = [
  new URL('../prisma/seed.ts', import.meta.url),
  new URL('../prisma/seed-prod.ts', import.meta.url),
].map((url) => readFileSync(fileURLToPath(url), 'utf8'));

function makeDef(overrides: Partial<ChatMenuDef> & Pick<ChatMenuDef, 'code' | 'sort'>): ChatMenuDef {
  return {
    name: 'name', nameEn: 'name', nameZhTW: 'name', nameFr: 'name',
    nameJa: 'name', nameRu: 'name', nameVi: 'name',
    path: '/path', icon: 'Icon',
    ...overrides,
  };
}

describe('validateChatMenuDefs', () => {
  test('accepts the real CHAT_MENU_DEFS list (16 items, sort 1..16, unique codes)', () => {
    expect(() => validateChatMenuDefs(CHAT_MENU_DEFS)).not.toThrow();
    expect(CHAT_MENU_DEFS).toHaveLength(16);
    expect(new Set(CHAT_MENU_DEFS.map((d) => d.code)).size).toBe(16);
    expect(CHAT_MENU_DEFS.map((d) => d.sort).slice().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    expect(CHAT_MENU_DEFS.find((d) => d.code === 'chat-dashboard')).toMatchObject({
      path: '/admin',
      icon: 'LayoutDashboard',
      visible: false,
    });
  });

  test('defaults menu visibility to true when visible is omitted', () => {
    expect(CHAT_MENU_DEFS.find((d) => d.code === 'generation-tasks')?.visible ?? true).toBe(true);
    expect(CHAT_MENU_DEFS.find((d) => d.code === 'chat-dashboard')?.visible ?? true).toBe(false);
  });

  test('keeps development and production menu upserts symmetric', () => {
    for (const source of seedSources) {
      expect(source).toContain('name: def.name');
      expect(source).toContain('path: def.path');
      expect(source).toContain('icon: def.icon');
      expect(source.match(/visible: def\.visible \?\? true/g)).toHaveLength(2);
      expect(source).toContain("def.code === 'chat-dashboard'");
      expect(source).toMatch(/menu(?:Id)?: chatDashboardMenu(?:\.id)?/);
    }
  });

  test('links chat-dashboard:read to the Chat admin role in both seeds', () => {
    for (const source of seedSources) {
      expect(source).toContain("code: 'chat-dashboard:read'");
      expect(source).toContain('permissionId: chatDashboardPermission.id');
      expect(source).toContain('rolePermission.upsert');
    }
  });

  test('accepts a well-formed minimal list', () => {
    const defs = [
      makeDef({ code: 'a', sort: 1 }),
      makeDef({ code: 'b', sort: 2 }),
      makeDef({ code: 'c', sort: 3 }),
    ];
    expect(() => validateChatMenuDefs(defs)).not.toThrow();
  });

  test('rejects duplicate code', () => {
    const defs = [
      makeDef({ code: 'a', sort: 1 }),
      makeDef({ code: 'a', sort: 2 }),
      makeDef({ code: 'b', sort: 3 }),
    ];
    expect(() => validateChatMenuDefs(defs)).toThrow(/duplicate code/);
  });

  test('rejects duplicate sort', () => {
    const defs = [
      makeDef({ code: 'a', sort: 1 }),
      makeDef({ code: 'b', sort: 1 }),
      makeDef({ code: 'c', sort: 2 }),
    ];
    expect(() => validateChatMenuDefs(defs)).toThrow(/duplicate sort/);
  });

  test('rejects non-contiguous sort (gap)', () => {
    const defs = [
      makeDef({ code: 'a', sort: 1 }),
      makeDef({ code: 'b', sort: 2 }),
      makeDef({ code: 'c', sort: 4 }),
    ];
    expect(() => validateChatMenuDefs(defs)).toThrow(/contiguous/);
  });

  test('rejects sort not starting at 1', () => {
    const defs = [
      makeDef({ code: 'a', sort: 2 }),
      makeDef({ code: 'b', sort: 3 }),
      makeDef({ code: 'c', sort: 4 }),
    ];
    expect(() => validateChatMenuDefs(defs)).toThrow(/contiguous/);
  });

  test('accepts an empty list', () => {
    expect(() => validateChatMenuDefs([])).not.toThrow();
  });
});
