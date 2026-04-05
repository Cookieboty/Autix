import { Test, TestingModule } from '@nestjs/testing';
import { RunnableMemoryService } from '../src/llm/memory/runnable-memory.service';

describe('RunnableMemoryService - E-commerce Customer Service', () => {
  let service: RunnableMemoryService;
  const sessionId = 's1';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RunnableMemoryService],
    }).compile();

    service = module.get<RunnableMemoryService>(RunnableMemoryService);
  });

  beforeEach(async () => {
    // Clear session before each test
    await service.clearSession(sessionId);
  });

  it('should handle multi-turn e-commerce customer service conversation', async () => {
    // Round 1: Customer reports issue
    const response1 = await service.chat(
      sessionId,
      '我买的蓝牙耳机降噪效果不好，想退货'
    );
    console.log('Round 1:', response1);
    expect(response1).toBeTruthy();

    // Round 2: Customer provides order number
    const response2 = await service.chat(sessionId, '订单号是 EC20240315001');
    console.log('Round 2:', response2);
    expect(response2).toBeTruthy();

    // Round 3: Customer asks for return eligibility
    const response3 = await service.chat(
      sessionId,
      '帮我判断一下这个订单能不能退'
    );
    console.log('Round 3:', response3);
    expect(response3).toBeTruthy();

    // Verify history
    const history = await service.getHistory(sessionId);
    console.log('History length:', history.length);
    expect(history.length).toBe(6); // 3 human + 3 AI messages
  });

  it('should retrieve conversation history', async () => {
    await service.chat(sessionId, '我想退货');
    await service.chat(sessionId, '订单号是 EC20240315001');

    const history = await service.getHistory(sessionId);
    expect(history.length).toBe(4); // 2 human + 2 AI messages
  });

  it('should clear session history', async () => {
    await service.chat(sessionId, '我想退货');
    await service.clearSession(sessionId);

    const history = await service.getHistory(sessionId);
    expect(history.length).toBe(0);
  });
});
