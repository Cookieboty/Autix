import { Test, TestingModule } from '@nestjs/testing';
import { FilesystemService } from '../src/llm/filesystem/filesystem.service';

describe('FilesystemService - E-commerce File Operations', () => {
  let service: FilesystemService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesystemService],
    }).compile();

    service = module.get<FilesystemService>(FilesystemService);
  });

  it('should query order details', async () => {
    const response = await service.fileChat('查询订单 EC20240315001 的详情');
    console.log('Query Order Response:', JSON.stringify(response, null, 2));

    expect(response.result).toBeTruthy();
    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe('query_order');
    expect(response.toolCalls[0].args.orderId).toBe('EC20240315001');
  });

  it('should read return policy file', async () => {
    const response = await service.fileChat(
      '读取 policies/return-policy.md 的退货政策'
    );
    console.log('Read Policy Response:', JSON.stringify(response, null, 2));

    expect(response.result).toBeTruthy();
    expect(response.toolCalls.length).toBeGreaterThan(0);
    expect(response.toolCalls[0].name).toBe('read_file');
    expect(response.toolCalls[0].args.filePath).toBe('policies/return-policy.md');
  });

  it('should write analysis to file', async () => {
    const response = await service.fileChat(
      '把退货判断结论写入 tickets/EC20240315001-analysis.md，内容是：订单 EC20240315001 符合退货条件，可以退货。'
    );
    console.log('Write File Response:', JSON.stringify(response, null, 2));

    expect(response.result).toBeTruthy();
    expect(response.toolCalls.some((tc) => tc.name === 'write_file')).toBe(true);
  });

  it('should handle complex multi-tool scenario', async () => {
    const response = await service.fileChat(
      '查询订单 EC20240315001，读取退货政策，然后判断这个订单能否退货，并将分析结果写入 tickets/EC20240315001-full-analysis.md'
    );
    console.log('Multi-tool Response:', JSON.stringify(response, null, 2));

    expect(response.result).toBeTruthy();
    expect(response.toolCalls.length).toBeGreaterThan(2);

    const toolNames = response.toolCalls.map((tc) => tc.name);
    expect(toolNames).toContain('query_order');
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('write_file');
  });
});
