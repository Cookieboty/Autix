import { CHAT_MENU_DEFS, validateChatMenuDefs, type ChatMenuDef } from '../prisma/seeds/chat-menus';

function makeDef(overrides: Partial<ChatMenuDef> & Pick<ChatMenuDef, 'code' | 'sort'>): ChatMenuDef {
  return {
    name: 'name', nameEn: 'name', nameZhTW: 'name', nameFr: 'name',
    nameJa: 'name', nameRu: 'name', nameVi: 'name',
    path: '/path', icon: 'Icon',
    ...overrides,
  };
}

describe('validateChatMenuDefs', () => {
  test('accepts the real CHAT_MENU_DEFS list (15 items, sort 1..15, unique codes)', () => {
    expect(() => validateChatMenuDefs(CHAT_MENU_DEFS)).not.toThrow();
    expect(CHAT_MENU_DEFS).toHaveLength(15);
    expect(new Set(CHAT_MENU_DEFS.map((d) => d.code)).size).toBe(15);
    expect(CHAT_MENU_DEFS.map((d) => d.sort).slice().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
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
