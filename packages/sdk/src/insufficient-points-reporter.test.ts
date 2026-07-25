import { describe, expect, it } from 'vitest';
import {
  isInsufficientPointsCode,
  matchInsufficientPointsMessage,
  parseInsufficientPointsMessage,
  registerInsufficientPointsReporter,
  reportInsufficientPoints,
} from './insufficient-points-reporter';

describe('isInsufficientPointsCode（跨语言首选：按稳定业务码识别）', () => {
  it('命中 INSUFFICIENT_POINTS 业务码', () => {
    expect(isInsufficientPointsCode('INSUFFICIENT_POINTS')).toBe(true);
  });
  it('其它码不命中', () => {
    expect(isInsufficientPointsCode('BAD_REQUEST')).toBe(false);
    expect(isInsufficientPointsCode(null)).toBe(false);
    expect(isInsufficientPointsCode(undefined)).toBe(false);
  });
});

describe('matchInsufficientPointsMessage（仅英文兜底；中文/多语言走业务码）', () => {
  it('命中英文关键词（大小写不敏感）', () => {
    expect(matchInsufficientPointsMessage('Insufficient Points to run')).toBe(true);
    expect(matchInsufficientPointsMessage('insufficient balance for this action')).toBe(true);
  });
  it('不再按翻译后的中文文案匹配（改由业务码识别）', () => {
    expect(matchInsufficientPointsMessage('积分余额不足：需要 100，当前 20')).toBe(false);
  });
  it('无匹配时返回 false', () => {
    expect(matchInsufficientPointsMessage('rate limit exceeded')).toBe(false);
    expect(matchInsufficientPointsMessage('')).toBe(false);
    expect(matchInsufficientPointsMessage(null)).toBe(false);
    expect(matchInsufficientPointsMessage(undefined)).toBe(false);
  });
});

describe('parseInsufficientPointsMessage（英文兜底解析；结构化 data 为首选，见 client-core）', () => {
  it('解析英文 required/available', () => {
    expect(
      parseInsufficientPointsMessage('Insufficient points: required 300, available 12'),
    ).toEqual({ required: 300, available: 12 });
  });
  it('允许含空格与小数', () => {
    expect(parseInsufficientPointsMessage('required  10.5 available  2.0')).toEqual({
      required: 10.5,
      available: 2,
    });
  });
  it('中文文案不再解析（金额改由 data.required/available 提供）', () => {
    expect(parseInsufficientPointsMessage('积分余额不足：需要 120，当前 45')).toEqual({
      required: null,
      available: null,
    });
  });
  it('无匹配返回 null', () => {
    expect(parseInsufficientPointsMessage('some other error')).toEqual({
      required: null,
      available: null,
    });
    expect(parseInsufficientPointsMessage(null)).toEqual({ required: null, available: null });
  });
});

describe('reporter 注入', () => {
  it('未注册时不抛错', () => {
    registerInsufficientPointsReporter(null);
    expect(() => reportInsufficientPoints({ msg: '积分不足' })).not.toThrow();
  });
  it('注册后按序回调，reporter 抛错不会向上传播', () => {
    const received: string[] = [];
    registerInsufficientPointsReporter((e) => {
      received.push(e.msg);
      throw new Error('boom');
    });
    expect(() => reportInsufficientPoints({ msg: '积分余额不足：需要 1，当前 0' })).not.toThrow();
    expect(received).toEqual(['积分余额不足：需要 1，当前 0']);
    registerInsufficientPointsReporter(null);
  });
});
