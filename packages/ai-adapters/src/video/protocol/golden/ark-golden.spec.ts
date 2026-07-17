import { describe, it, expect } from 'vitest';
import { assembleVideoRequest } from '../assemble';
import { arkVideoV3 } from '../presets/vendors';
import type { VideoCallRequest, VideoMaterialInput } from '../types';
import fixtures from './ark-request.fixtures.json';

type Fixture = {
  name: string;
  input: {
    model: string;
    prompt: string | null;
    materials: VideoMaterialInput[];
    params: Record<string, unknown>;
    callbackUrl?: string;
  };
  expected: Record<string, unknown>;
};

/**
 * Golden：arkVideoV3 preset 产出的请求体是「Ark 线上请求形态」的唯一可执行规格。
 *
 * 计划 4 会删掉 SeedanceApiService（在生产跑的实现）。删除之前，本测试的每一条
 * fixture 都必须绿 —— 它把「删掉它」从一次信仰之跃变成一次可验证的重构。
 * 旧实现删除后 fixtures **永久保留**：后续任何 preset 改动若无意中改变了 Ark 的
 * 线上行为，会被它拦下。
 *
 * 断言用深度相等而非逐字节字符串比较：buildTaskRequest 按 if 顺序插入 key，而
 * JSON.stringify 保留插入顺序 —— 逐字节比较会把 paramBindings 的声明顺序变成隐性
 * 契约（无害的重排会误报），而 key 顺序对 JSON HTTP 不是行为差异。
 */
describe('golden: arkVideoV3 request shape', () => {
  for (const fixture of fixtures as Fixture[]) {
    it(fixture.name, () => {
      const req: VideoCallRequest = {
        preset: arkVideoV3,
        baseUrl: 'https://api.example.com',
        apiKey: 'k',
        model: fixture.input.model,
        prompt: fixture.input.prompt,
        materials: fixture.input.materials,
        params: fixture.input.params,
        callbackUrl: fixture.input.callbackUrl,
      };
      expect(assembleVideoRequest(req)).toEqual(fixture.expected);
    });
  }

  it('covers every VideoMaterialRole', () => {
    const covered = new Set(
      (fixtures as Fixture[]).flatMap((f) => f.input.materials.map((m) => m.role)),
    );
    // 漏一个角色 = 漏一整类素材的组装未被验证。roleItems 的键集就是 VideoMaterialRole 全集。
    expect([...covered].sort()).toEqual(Object.keys(arkVideoV3.submit.content.roleItems).sort());
  });
});
