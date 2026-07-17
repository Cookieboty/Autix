/**
 * 以子进程启动真实编译产物 node dist/main.js，最贴近真实运行
 * （tsx/esbuild 无法为 Nest 注入装饰器元数据，无法进程内 boot 整个模块图）。
 * 注入 stripe listen 提供的 webhook 密钥。
 */
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { E2E } from './config';

// services/api —— __dirname 在 vitest/tsx 下均可用；缺失时回退到 cwd（test:e2e 从 services/api 运行）
const API_ROOT =
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, '..', '..') : process.cwd();
const SERVER_LOG = process.env.E2E_SERVER_LOG ?? path.join(os.tmpdir(), 'autix-e2e-server.log');

export type ServerHandle = { stop: () => void; proc: ChildProcess };

/** SIGINT 优雅退出，3s 内没走就 SIGKILL，避免子进程吊住测试进程不退出。 */
export function hardStop(proc: ChildProcess) {
  try {
    proc.kill('SIGINT');
  } catch {
    /* noop */
  }
  const t = setTimeout(() => {
    try {
      proc.kill('SIGKILL');
    } catch {
      /* noop */
    }
  }, 3_000);
  t.unref?.();
}

export async function startServer(webhookSecret: string): Promise<ServerHandle> {
  const proc = spawn('node', ['dist/main.js'], {
    cwd: API_ROOT,
    env: {
      ...process.env,
      PORT: String(E2E.port),
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // 把子进程输出写到日志文件，便于诊断崩溃
  const logStream = fs.createWriteStream(SERVER_LOG, { flags: 'w' });
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);

  const deadline = Date.now() + E2E.serverReadyTimeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`dist server 提前退出，code=${proc.exitCode}`);
    try {
      const res = await fetch(`${E2E.baseUrl}/orders`);
      if (res.status > 0) return { stop: () => hardStop(proc), proc };
    } catch {
      // 未就绪，继续等
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  proc.kill('SIGINT');
  throw new Error(`dist server 未在 ${E2E.serverReadyTimeoutMs}ms 内就绪`);
}
