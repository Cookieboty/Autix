import 'reflect-metadata';
import { VideoGenController } from './video-gen.controller';
import { VideoModule } from './video.module';
import { GalleryModule } from '../gallery/gallery.module';

/**
 * 控制器构造函数注入的 provider，必须能由 VideoModule 的 imports 解析出来。
 *
 * 存在原因：本目录其余 spec 全是 `new VideoGenController({} as any, ...)` 手工构造，
 * 完全绕过 DI 容器 —— 曾漏掉 GalleryModule 的 import，类型检查与全部单测都通过，
 * 但 Nest bootstrap 时抛 UnknownDependenciesException，整个 API 起不来。
 *
 * 这里不拉起完整 TestingModule（要连数据库等一堆真实依赖），只做静态断言：
 * 读 design:paramtypes 元数据拿到构造参数类型，逐个确认「要么由本模块自己 provide，
 * 要么由某个被 import 的模块 export」。
 */
function paramTypes(target: unknown): unknown[] {
  return (Reflect.getMetadata('design:paramtypes', target as object) as unknown[]) ?? [];
}

function moduleMeta(target: unknown, key: 'imports' | 'providers' | 'exports'): unknown[] {
  return (Reflect.getMetadata(key, target as object) as unknown[]) ?? [];
}

describe('VideoModule 依赖完整性', () => {
  it('VideoGenController 的每个注入项都能被解析', () => {
    const deps = paramTypes(VideoGenController);
    expect(deps.length).toBeGreaterThan(0);

    const ownProviders = new Set(moduleMeta(VideoModule, 'providers'));
    const importedExports = new Set(
      moduleMeta(VideoModule, 'imports').flatMap((mod) => moduleMeta(mod, 'exports')),
    );

    const unresolved = deps.filter(
      (dep) => !ownProviders.has(dep) && !importedExports.has(dep),
    );

    expect(
      unresolved.map((dep) => (dep as { name?: string })?.name ?? String(dep)),
    ).toEqual([]);
  });

  it('GalleryModule 导出 GalleryService 且被 VideoModule import', () => {
    // 上一条断言的前提：GalleryService 只能经由 GalleryModule 的 exports 拿到
    expect(moduleMeta(VideoModule, 'imports')).toContain(GalleryModule);
    expect(moduleMeta(GalleryModule, 'exports').length).toBeGreaterThan(0);
  });
});
