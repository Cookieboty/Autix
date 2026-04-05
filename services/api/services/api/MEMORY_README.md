# Memory Service - 电商客服多轮对话

## 功能概述

在 `services/api` 的 LangChain 层中实现了 Memory 机制，支持多轮对话上下文记忆。

## 实现内容

### 1. 核心服务

**文件**: `src/llm/memory/runnable-memory.service.ts`

实现了两个版本的对话链：

- **完整历史版本**: 使用 `RunnableWithMessageHistory` + `InMemoryChatMessageHistory`
- **消息裁剪版本**: 使用 `trimMessages` (maxTokens: 2000, strategy: 'last')

核心方法：
- `chat(sessionId, input)`: 多轮对话（完整历史）
- `chatWithTrimming(sessionId, input)`: 多轮对话（裁剪历史）
- `getHistory(sessionId)`: 获取会话历史
- `appendMessage(sessionId, human, ai)`: 手动添加消息
- `clearSession(sessionId)`: 清除会话记忆

### 2. API 路由

**文件**: `src/llm/memory/memory.controller.ts`

**Controller**: `@Controller('api/memory')`

路由：
- `POST /api/memory/chat`: 多轮对话
- `GET /api/memory/history?sessionId=xxx`: 获取历史记录
- `DELETE /api/memory/clear`: 清除会话

### 3. 模块注册

已在 `src/llm/llm.module.ts` 中注册：
- `RunnableMemoryService` (Provider)
- `MemoryController` (Controller)

## 业务场景：电商客服系统

系统提示词配置为专业的电商客服助手，能够：
1. 理解客户问题和需求
2. 记住对话中的关键信息（订单号、商品信息等）
3. 根据上下文提供准确帮助
4. 处理退货请求（需要订单号）

## 测试场景

使用 sessionId `"s1"` 进行三轮对话：

### 第一轮
```bash
curl -X POST http://localhost:3000/api/memory/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "s1",
    "input": "我买的蓝牙耳机降噪效果不好，想退货"
  }'
```

### 第二轮
```bash
curl -X POST http://localhost:3000/api/memory/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "s1",
    "input": "订单号是 EC20240315001"
  }'
```

### 第三轮
```bash
curl -X POST http://localhost:3000/api/memory/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "s1",
    "input": "帮我判断一下这个订单能不能退"
  }'
```

### 查看历史记录
```bash
curl -X GET "http://localhost:3000/api/memory/history?sessionId=s1"
```

### 清除会话
```bash
# 方式 1: Query 参数（推荐）
curl -X DELETE "http://localhost:3000/api/memory/clear?sessionId=s1"

# 方式 2: Body
curl -X DELETE http://localhost:3000/api/memory/clear \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "s1"}'
```

## 技术实现细节

### Session 隔离
- 使用 `Map<string, InMemoryChatMessageHistory>` 存储不同会话的历史
- 每个 sessionId 对应独立的消息历史

### 消息裁剪
- `trimMessages` 配置：maxTokens: 2000, strategy: 'last'
- 保留最近的消息，避免上下文过长

### Prompt 模板
使用 `ChatPromptTemplate.fromMessages` 构建：
- System message: 电商客服角色定义
- MessagesPlaceholder: 历史消息占位符
- Human message: 用户输入

## 运行测试

```bash
# 类型检查
bun run typecheck

# 构建
bun run build

# 启动服务
bun run dev

# 运行测试
bun test test/memory.spec.ts
```

## 依赖说明

所需依赖已在 `package.json` 中：
- `@langchain/core`: 核心功能
- `@langchain/openai`: OpenAI 模型
- `langchain`: LangChain 主包

无需额外安装依赖。
