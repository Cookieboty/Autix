import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { getDatabaseUrl, PrismaClient } from '@autix/database';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: getDatabaseUrl(),
    });
    super({
      adapter,
      /**
       * Prisma 交互式事务的默认超时是 **5 秒**，而本项目的写事务普遍是「多条串行写」
       * （下单：扣费账本 + hold；落库：结算 + generation + 模板计数 + 消息 + 资产），
       * 每一条都是一次到数据库的往返。数据库不在本机时（远端/跨区），这个默认值会被
       * 常规业务流轻易超过 —— 实测创建 hold 5.9s、图片落库 7.2s，都被斩断。
       *
       * 超时的代价不是「重试一次」：事务回滚，但**上游已经调过、钱已经花了、图已经
       * 传进对象存储**。用户付了钱、看到 500、图没了。
       *
       * 这些事务本身是对的（扣费与入库必须原子，不能拆），所以正确的做法是给足时间。
       * 在 client 上设一次全局默认，而不是逐个事务打补丁——否则下一个重事务还会踩。
       */
      transactionOptions: {
        timeout: 30_000,
        // 拿不到连接时最多等 10s 再放弃（默认 2s，连接池被打满时会误报事务失败）
        maxWait: 10_000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
