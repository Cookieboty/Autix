import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GenerationTaskListQueryDto } from './generation-task-query.dto';

function parse(raw: Record<string, unknown>) {
  const dto = plainToInstance(GenerationTaskListQueryDto, raw);
  return { dto, errors: validateSync(dto) };
}

describe('GenerationTaskListQueryDto', () => {
  it('limit 缺省为 20，字符串会被转成数字', () => {
    const { dto, errors } = parse({ limit: '50' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(50);
    expect(parse({}).dto.limit).toBe(20);
  });

  it('limit 上限 100 —— 防止管理员一次拉爆库', () => {
    expect(parse({ limit: '101' }).errors.length).toBeGreaterThan(0);
    expect(parse({ limit: '0' }).errors.length).toBeGreaterThan(0);
  });

  it('kind / status / errorStage 只接受 Prisma 枚举值', () => {
    expect(parse({ kind: 'IMAGE' }).errors).toHaveLength(0);
    expect(parse({ kind: 'AUDIO' }).errors.length).toBeGreaterThan(0);
    expect(parse({ status: 'FAILED' }).errors).toHaveLength(0);
    expect(parse({ errorStage: 'SUBMIT' }).errors).toHaveLength(0);
    expect(parse({ errorStage: 'NOPE' }).errors.length).toBeGreaterThan(0);
  });

  it('from / to 必须是 ISO 日期串', () => {
    expect(parse({ from: '2026-07-01T00:00:00.000Z' }).errors).toHaveLength(0);
    expect(parse({ from: 'yesterday' }).errors.length).toBeGreaterThan(0);
  });

  it('未提供的筛选项保持 undefined，不得变成空串', () => {
    const { dto } = parse({});
    expect(dto.userId).toBeUndefined();
    expect(dto.q).toBeUndefined();
  });
});
