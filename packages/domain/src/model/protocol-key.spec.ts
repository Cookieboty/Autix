import { describe, it, expect } from 'vitest';
import { readProtocolKey } from './protocol-key';

describe('readProtocolKey', () => {
  it('reads a protocolKey from model metadata', () => {
    expect(readProtocolKey({ protocolKey: 'ark-video@v3' })).toBe('ark-video@v3');
  });

  it('returns undefined when metadata declares no protocolKey', () => {
    expect(readProtocolKey({ videoModelKind: 'seedance-2.0-fast' })).toBeUndefined();
  });

  // 空串不是「声明了协议」—— 否则会被当成一个名为 '' 的未注册 key 而报错，
  // 而真实语义是「这个模型没有协议概念」（如纯文本模型）。
  it('treats an empty or blank protocolKey as absent', () => {
    expect(readProtocolKey({ protocolKey: '' })).toBeUndefined();
    expect(readProtocolKey({ protocolKey: '   ' })).toBeUndefined();
  });

  it('ignores non-string protocolKey', () => {
    expect(readProtocolKey({ protocolKey: 123 })).toBeUndefined();
    expect(readProtocolKey({ protocolKey: null })).toBeUndefined();
  });

  it('tolerates non-object metadata', () => {
    expect(readProtocolKey(null)).toBeUndefined();
    expect(readProtocolKey(undefined)).toBeUndefined();
    expect(readProtocolKey('nope')).toBeUndefined();
    expect(readProtocolKey([])).toBeUndefined();
  });
});
