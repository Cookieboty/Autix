import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EstimateTaskDto } from './estimate-task.dto';

describe('EstimateTaskDto', () => {
  it('accepts a well-formed body', async () => {
    const dto = plainToInstance(EstimateTaskDto, {
      taskType: 'image_generation',
      modelConfigId: 'model-1',
      params: { quality: 'medium' },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts an omitted modelConfigId and usage', async () => {
    const dto = plainToInstance(EstimateTaskDto, {
      taskType: 'image_generation',
      params: {},
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing taskType', async () => {
    const dto = plainToInstance(EstimateTaskDto, { params: {} });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'taskType')).toBe(true);
  });

  it('rejects a non-object params', async () => {
    const dto = plainToInstance(EstimateTaskDto, { taskType: 'x', params: 'nope' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'params')).toBe(true);
  });
});
