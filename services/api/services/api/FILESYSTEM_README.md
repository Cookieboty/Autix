# Filesystem Service - 文件系统与业务查询工具

## 功能概述

在 `services/api` 的 LangChain 层中实现了文件系统与业务查询工具，支持订单查询、商品查询、文件读写等操作。

## 实现内容

### 1. 业务工具定义

**文件**: `src/llm/tools/business.tools.ts`

使用 `tool()` + `zod schema` 定义了四个工具：

#### query_order
- **功能**: 根据订单号查询订单详情
- **文件路径**: `workspace/orders/{orderId}.json`
- **Schema**: `{ orderId: string }`

#### query_product
- **功能**: 根据商品 ID 查询商品详情
- **文件路径**: `workspace/products/{productId}.json`
- **Schema**: `{ productId: string }`

#### read_file
- **功能**: 读取 workspace/ 下指定路径的文件内容（政策、FAQ 等）
- **Schema**: `{ filePath: string }`

#### write_file
- **功能**: 将内容写入 workspace/ 下指定路径（工单、报告）
- **Schema**: `{ filePath: string, content: string }`

**安全机制**: 所有文件操作通过 `safePath()` 函数进行沙箱校验，限制在 `workspace/` 目录下，防止路径穿越攻击。

### 2. 文件系统服务

**文件**: `src/llm/filesystem/filesystem.service.ts`

实现了完整的工具执行闭环（tool-loop 模式）：

1. 绑定四个业务工具到模型
2. 初始调用模型
3. 检查是否有工具调用
4. 执行工具并将结果添加到对话历史
5. 继续调用模型直到没有工具调用或达到最大迭代次数（10 次）

核心方法：
- `fileChat(input)`: 接收用户输入，返回 `{ result, toolCalls }`

### 3. API 路由

**文件**: `src/llm/filesystem/files.controller.ts`

**Controller**: `@Controller('api/files')`

路由：
- `POST /api/files/file-chat`: 接收 `{ input }`，模型可按需调用工具读写文件

### 4. 模块注册

已在 `src/llm/llm.module.ts` 中注册：
- `FilesystemService` (Provider)
- `FilesController` (Controller)

## 业务场景：电商客服系统

### 测试数据

已创建以下测试数据：

#### 订单数据
`workspace/orders/EC20240315001.json`:
```json
{
  "orderId": "EC20240315001",
  "customerId": "CUST10086",
  "customerName": "张三",
  "orderDate": "2024-03-15T10:30:00Z",
  "status": "delivered",
  "deliveryDate": "2024-03-18T14:20:00Z",
  "totalAmount": 599,
  "items": [
    {
      "productId": "PROD001",
      "productName": "蓝牙降噪耳机",
      "quantity": 1,
      "price": 599
    }
  ],
  "shippingAddress": "北京市朝阳区xxx街道xxx号",
  "returnEligible": true,
  "returnDeadline": "2024-04-01T23:59:59Z"
}
```

#### 商品数据
`workspace/products/PROD001.json`:
```json
{
  "productId": "PROD001",
  "productName": "蓝牙降噪耳机",
  "brand": "SoundMax",
  "category": "电子产品",
  "price": 599,
  "stock": 150,
  "features": ["主动降噪", "蓝牙5.0", "续航30小时", "快充支持"],
  "warranty": "1年质保",
  "returnPolicy": "7天无理由退货"
}
```

#### 退货政策
`workspace/policies/return-policy.md`: 包含完整的退货条件、流程、退款方式等信息

## 测试场景

### 场景 1: 查询订单详情
```bash
curl -X POST http://localhost:3000/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{"input": "查询订单 EC20240315001 的详情"}'
```

**预期行为**:
- 模型调用 `query_order` 工具
- 读取 `workspace/orders/EC20240315001.json`
- 返回订单详情和工具调用日志

### 场景 2: 读取退货政策
```bash
curl -X POST http://localhost:3000/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{"input": "读取 policies/return-policy.md 的退货政策"}'
```

**预期行为**:
- 模型调用 `read_file` 工具
- 读取 `workspace/policies/return-policy.md`
- 返回政策内容摘要

### 场景 3: 写入分析报告
```bash
curl -X POST http://localhost:3000/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{"input": "把退货判断结论写入 tickets/EC20240315001-analysis.md"}'
```

**预期行为**:
- 模型调用 `write_file` 工具
- 创建 `workspace/tickets/` 目录（如不存在）
- 写入分析报告文件

### 场景 4: 复杂多工具场景
```bash
curl -X POST http://localhost:3000/api/files/file-chat \
  -H "Content-Type: application/json" \
  -d '{
    "input": "查询订单 EC20240315001，读取退货政策，判断能否退货，并将分析结果写入 tickets/EC20240315001-full-analysis.md"
  }'
```

**预期行为**:
- 依次调用 `query_order`、`read_file`、`write_file` 工具
- 完整的工具执行闭环
- 返回综合分析结果

## 技术实现细节

### 沙箱安全机制

```typescript
function safePath(relativePath: string): string {
  const fullPath = path.join(WORKSPACE_ROOT, relativePath);
  const normalized = path.normalize(fullPath);

  if (!normalized.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Path traversal detected: access denied');
  }

  return normalized;
}
```

防止路径穿越攻击，例如：
- `../../../etc/passwd` ❌ 被拒绝
- `orders/EC20240315001.json` ✅ 允许

### Tool-Loop 模式

参考 `llm.service.ts` 中的 `toolLoop` 方法实现：

1. **初始调用**: 格式化 prompt 并调用模型
2. **检查工具调用**: 检查 `response.tool_calls`
3. **执行工具**: 根据工具名称调用对应工具
4. **添加工具消息**: 将工具结果作为 `ToolMessage` 添加到对话历史
5. **继续对话**: 使用更新后的消息历史再次调用模型
6. **循环直到完成**: 重复步骤 2-5，直到没有工具调用或达到最大迭代次数

### 错误处理

- 文件不存在: 返回 `{ success: false, error: '文件不存在' }`
- 路径穿越: 抛出异常 `'Path traversal detected: access denied'`
- 工具执行失败: 捕获异常并作为 `ToolMessage` 返回

## 运行测试

```bash
# 类型检查
bun run typecheck

# 构建
bun run build

# 启动服务
bun run dev

# 运行测试
bun test test/filesystem.spec.ts
```

## 目录结构

```
services/api/
├── src/llm/
│   ├── tools/
│   │   ├── basic.tools.ts
│   │   └── business.tools.ts          # 新增：业务工具定义
│   ├── filesystem/
│   │   ├── filesystem.service.ts      # 新增：文件系统服务
│   │   └── files.controller.ts        # 新增：文件路由
│   └── llm.module.ts                  # 更新：注册新服务
├── workspace/                          # 新增：工作目录
│   ├── orders/
│   │   └── EC20240315001.json
│   ├── products/
│   │   └── PROD001.json
│   ├── policies/
│   │   └── return-policy.md
│   └── tickets/                       # 动态创建
└── test/
    └── filesystem.spec.ts             # 新增：测试文件
```

## 依赖说明

使用 Node.js 内置模块：
- `fs/promises`: 异步文件操作
- `path`: 路径处理

无需额外安装依赖。
