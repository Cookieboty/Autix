import { describe, expect, it } from 'vitest';
import {
  matchInsufficientPointsMessage,
  parseInsufficientPointsMessage,
  registerInsufficientPointsReporter,
  reportInsufficientPoints,
} from './insufficient-points-reporter';

describe('matchInsufficientPointsMessage', () => {
  it('命中中文关键词', () => {
    expect(matchInsufficientPointsMessage('积分余额不足：需要 100，当前 20')).toBe(true);
    expect(matchInsufficientPointsMessage('抱歉，积分不足')).toBe(true);
  });
  it('命中英文关键词（大小写不敏感）', () => {
    expect(matchInsufficientPointsMessage('Insufficient Points to run')).toBe(true);
    expect(matchInsufficientPointsMessage('insufficient balance for this action')).toBe(true);
  });
  it('无匹配时返回 false', () => {
    expect(matchInsufficientPointsMessage('rate limit exceeded')).toBe(false);
    expect(matchInsufficientPointsMessage('')).toBe(false);
    expect(matchInsufficientPointsMessage(null)).toBe(false);
    expect(matchInsufficientPointsMessage(undefined)).toBe(false);
  });
});

describe('parseInsufficientPointsMessage', () => {
  it('解析中文 required/available', () => {
    expect(parseInsufficientPointsMessage('积分余额不足：需要 120，当前 45')).toEqual({
      required: 120,
      available: 45,
    });
  });
  it('解析英文 required/available', () => {
    expect(
      parseInsufficientPointsMessage('Insufficient points: required 300, available 12'),
    ).toEqual({ required: 300, available: 12 });
  });
  it('允许含空格与小数', () => {
    expect(parseInsufficientPointsMessage('需要  10.5 当前  2.0')).toEqual({
      required: 10.5,
      available: 2,
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
