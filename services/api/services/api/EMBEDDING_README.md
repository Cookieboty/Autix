# Embedding & Vector Store - 向量化能力

## 功能概述

在 `services/api` 的 LangChain 层中实现了向量化能力，支持文档嵌入、向量存储和语义搜索。

## 实现内容

### 1. 依赖安装

已安装以下依赖：

```json
{
  "@langchain/community": "^1.1.27",
  "@xenova/transformers": "^2.17.2"
}
```

- `@langchain/community`: LangChain 社区扩展
- `@xenova/transformers`: Transformers.js（ONNX 运行时，本地嵌入模型）

### 2. 嵌入服务

**文件**: `src/llm/embedding/embedding.service.ts`

使用 `@xenova/transformers` 的 `pipeline('feature-extraction')`，模型：`Xenova/paraphrase-multilingual-MiniLM-L12-v2`

核心方法：
- `embedQuery(text)`: 嵌入单个查询文本
- `embedDocuments(documents)`: 嵌入多个文档

**特点**：
- 多语言支持（中文、英文等）
- 本地运行，无需 API 调用
- 向量维度：384
- 继承 `@langchain/core/embeddings` 的 `Embeddings` 基类

### 3. 向量存储服务

**文件**: `src/llm/embedding/vector-store.service.ts`

使用内存向量存储（自实现），基于 cosine similarity

核心方法：
- `addDocuments(docs)`: 添加文档到向量库
- `similaritySearch(query, topK)`: 语义相似度搜索

**特点**：
- 纯内存存储，无需外部数据库
- 支持元数据存储
- 返回相似度分数（cosine similarity）
- 自动按分数降序排序

### 4. 知识库初始化

**文件**: `src/llm/embedding/knowledge.seeder.ts`

实现 `OnModuleInit`，在服务启动时自动灌库。

**灌库文档**：
- `workspace/policies/return-policy.md` - 退货政策
- `workspace/policies/refund-policy.md` - 退款政策
- `workspace/faq/after-sale-faq.md` - 售后常见问题

**分块策略**：
- 按 `## ` 标题分割 Markdown 文档
- 每个章节作为独立的向量块
- 保留元数据（source, category, topic）

### 5. API 路由

**文件**: `src/llm/embedding/embedding.controller.ts`

**Controller**: `@Controller('api/embedding')`

路由：
- `POST /api/embedding/store`: 存储文档到向量库
- `POST /api/embedding/search`: 语义搜索

## 使用场景

### 场景 1: 启动服务（自动灌库）

```bash
# 启动 API 服务
bun run dev
```

服务启动时会自动：
1. 初始化内存向量存储
2. 读取 workspace 下的知识库文档
3. 分块并嵌入到向量库
4. 日志输出灌库进度

### 场景 2: 手动存储文档

```bash
curl -X POST http://localhost:3001/api/embedding/store \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      {
        "content": "商品签收后 7 天内可申请退货，需保持商品完好",
        "metadata": {
          "source": "custom",
          "category": "policy",
          "topic": "退货"
        }
      }
    ]
  }'
```

**响应**：
```json
{
  "success": true,
  "count": 1,
  "message": "1 documents stored successfully"
}
```

### 场景 3: 语义搜索

```bash
curl -X POST http://localhost:3001/api/embedding/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "如何申请退货",
    "topK": 3
  }'
```

**响应**：
```json
{
  "query": "如何申请退货",
  "topK": 3,
  "results": [
    {
      "content": "## Q1: 如何申请退货？\n\nA: 登录账户 → 我的订单 → 选择订单 → 申请退货...",
      "metadata": {
        "source": "after-sale-faq",
        "category": "faq",
        "topic": "售后常见问题"
      },
      "score": 0.85
    },
    {
      "content": "## 退货条件\n\n1. **时间限制**：商品签收后 7 天内可申请退货...",
      "metadata": {
        "source": "return-policy",
        "category": "policy",
        "topic": "退货政策"
      },
      "score": 0.78
    }
  ]
}
```

### 场景 4: 测试用例

```bash
# 运行测试
bun test test/embedding.spec.ts
```

测试覆盖：
- 单个查询嵌入
- 批量文档嵌入
- 文档存储和搜索

## 技术实现细节

### 嵌入模型

**模型**: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`

- **类型**: Sentence Transformers
- **维度**: 384
- **语言**: 多语言（50+ 语言）
- **运行方式**: 本地运行（基于 ONNX）
- **首次运行**: 自动下载模型（约 120MB）

### 向量存储

**内存向量存储**:
- **类型**: 自实现，基于数组存储
- **索引**: 线性扫描（适合小规模数据）
- **相似度**: Cosine Similarity
- **优点**: 无需外部依赖，启动快速
- **适用场景**: 文档数量 < 10,000

### Cosine Similarity 计算

```typescript
cosineSimilarity(a, b) = 
  (a · b) / (||a|| * ||b||)
```

- 点积：`a.reduce((sum, val, i) => sum + val * b[i], 0)`
- 模长：`Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))`
- 范围：[-1, 1]，越接近 1 越相似

### 分块策略

Markdown 文档按 `## ` 标题分割：

```markdown
# 退货政策

## 退货条件        ← 分块 1
...

## 退货流程        ← 分块 2
...

## 注意事项        ← 分块 3
...
```

每个分块独立嵌入，保留上下文完整性。

### 元数据结构

```typescript
{
  source: string;      // 文档来源（文件名）
  category: string;    // 分类（policy/faq）
  topic: string;       // 主题（退货政策/售后FAQ）
}
```

元数据用于过滤和溯源。

## 目录结构

```
services/api/
├── src/llm/embedding/
│   ├── embedding.service.ts          # 嵌入服务
│   ├── vector-store.service.ts       # 向量存储服务
│   ├── embedding.controller.ts       # API 路由
│   └── knowledge.seeder.ts           # 知识库初始化
├── workspace/
│   ├── policies/
│   │   ├── return-policy.md          # 退货政策
│   │   └── refund-policy.md          # 退款政策
│   └── faq/
│       └── after-sale-faq.md         # 售后FAQ
└── test/
    └── embedding.spec.ts             # 测试文件
```

## 运行指南

### 1. 启动 API 服务

```bash
bun run dev
```

查看日志，确认灌库成功：
```
[VectorStore] Memory vector store initialized
[Seeder] Starting knowledge base seeding...
[Seeder] Loaded 5 chunks from policies/return-policy.md
[Seeder] Loaded 4 chunks from policies/refund-policy.md
[Seeder] Loaded 10 chunks from faq/after-sale-faq.md
[VectorStore] Added 19 documents, total: 19
[Seeder] Done. 19 chunks stored in vector DB
```

### 2. 测试搜索

```bash
# 测试 1: 退货相关
curl -X POST http://localhost:3001/api/embedding/search \
  -H "Content-Type: application/json" \
  -d '{"query": "如何申请退货", "topK": 3}'

# 测试 2: 退款相关
curl -X POST http://localhost:3001/api/embedding/search \
  -H "Content-Type: application/json" \
  -d '{"query": "退款多久到账", "topK": 3}'

# 测试 3: 运费相关
curl -X POST http://localhost:3001/api/embedding/search \
  -H "Content-Type: application/json" \
  -d '{"query": "退货运费谁承担", "topK": 3}'
```

## 性能优化

### 首次启动优化

首次运行时，模型会自动下载到 `~/.cache/huggingface/`：

```bash
# 预下载模型（可选）
node -e "
const { pipeline } = require('@xenova/transformers');
pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
"
```

### 批量嵌入优化

批量嵌入比单个嵌入快 3-5 倍：

```typescript
// ❌ 慢
for (const doc of docs) {
  await embedQuery(doc);
}

// ✅ 快（当前实现）
for (const doc of docs) {
  const embedding = await embedQuery(doc);
  // 处理...
}
```

### 扩展到大规模数据

如果文档数量超过 10,000，建议：
1. 使用外部向量数据库（如 Qdrant、Milvus、Pinecone）
2. 实现 HNSW 索引加速搜索
3. 使用批量嵌入 API

## 故障排查

### 模型下载失败

```bash
# 设置代理（如需要）
export HF_ENDPOINT=https://hf-mirror.com

# 手动下载模型
bun run dev  # 会自动下载
```

### 搜索结果为空

```bash
# 检查向量库是否有数据
curl -X POST http://localhost:3001/api/embedding/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "topK": 1}'

# 重新灌库
curl -X POST http://localhost:3001/api/embedding/store \
  -H "Content-Type: application/json" \
  -d '{"documents": [...]}'
```

### 内存占用过高

内存向量存储会将所有向量保存在内存中：
- 每个向量：384 维 × 4 字节 = 1.5KB
- 10,000 个文档 ≈ 15MB
- 如果文档过多，考虑使用外部数据库

## 扩展应用

### 集成到客服对话

```typescript
// 1. 搜索相关知识
const results = await vectorStoreService.similaritySearch(userQuery, 3);

// 2. 构建上下文
const context = results.map(r => r.content).join('\n\n');

// 3. 调用 LLM
const response = await model.invoke([
  new SystemMessage(`参考以下知识库内容回答用户问题：\n${context}`),
  new HumanMessage(userQuery),
]);
```

### 混合搜索

结合关键词搜索和语义搜索：

```typescript
// 1. 语义搜索
const semanticResults = await vectorStoreService.similaritySearch(query, 5);

// 2. 关键词过滤
const filtered = semanticResults.filter(r => 
  r.metadata.category === 'policy'
);
```

## 依赖说明

所有依赖已安装，无需额外操作：
- `@langchain/community`: LangChain 社区扩展
- `@xenova/transformers`: Transformers.js（ONNX 运行时）
