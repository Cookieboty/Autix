/**
 * expert-tools.ts
 * 
 * Multi-Agent 专家工具集：为功能、性能、安全、合规四类专家提供专用工具
 * 当前为 Mock 实现，实际项目中应该连接真实的数据源
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// ============================================================================
// 功能专家工具
// ============================================================================

/**
 * 工具：读取功能规范文档
 * 查询功能模块的详细规范和设计文档
 */
export const readFeatureSpecTool = tool(
  async ({ module }: { module: string }) => {
    // Mock 实现：实际项目中应该查询文档库或知识库
    const mockSpecs: Record<string, any> = {
      '用户管理': {
        module: '用户管理',
        version: 'v2.3.0',
        features: ['用户注册', '登录验证', '权限管理', '密码重置'],
        apis: [
          'POST /api/users/register',
          'POST /api/users/login',
          'GET /api/users/profile',
          'PUT /api/users/password',
        ],
        dependencies: ['认证服务', '邮件服务'],
        constraints: ['需支持 OAuth 2.0', '密码必须加密存储'],
      },
      '数据统计': {
        module: '数据统计',
        version: 'v1.5.0',
        features: ['实时统计', '报表生成', '数据导出', '图表展示'],
        apis: [
          'GET /api/stats/realtime',
          'POST /api/stats/report',
          'GET /api/stats/export',
        ],
        dependencies: ['数据仓库', 'Redis缓存'],
        constraints: ['查询响应时间 < 3秒', '支持百万级数据量'],
      },
      '前端重构': {
        module: '前端重构',
        version: 'v3.0.0-beta',
        features: ['组件化架构', '响应式设计', '状态管理', '路由优化'],
        apis: [],
        dependencies: ['React 18', 'TypeScript', 'Vite'],
        constraints: ['兼容 Chrome 90+', 'IE11 不再支持'],
      },
    };

    const spec = mockSpecs[module];
    
    if (!spec) {
      return `模块 "${module}" 的功能规范未找到。可用模块：${Object.keys(mockSpecs).join('、')}`;
    }

    return `模块 "${module}" 功能规范：
版本：${spec.version}
核心功能：${spec.features.join('、')}
${spec.apis.length > 0 ? `API 接口：\n${spec.apis.map((api: string) => `  - ${api}`).join('\n')}` : ''}
依赖项：${spec.dependencies.join('、')}
约束条件：${spec.constraints.join('；')}`;
  },
  {
    name: 'read_feature_spec',
    description: '读取功能模块的详细规范文档。参数 module 为模块名称（如"用户管理"、"数据统计"）',
    schema: z.object({
      module: z.string().describe('功能模块名称，如"用户管理"、"数据统计"、"前端重构"'),
    }),
  }
);

// ============================================================================
// 性能专家工具
// ============================================================================

/**
 * 工具：加载性能基线数据
 * 获取当前系统的性能基准指标
 */
export const loadPerfBaselineTool = tool(
  async ({ service }: { service: string }) => {
    // Mock 实现：实际项目中应该查询监控系统（如 Prometheus、Datadog）
    const mockBaselines: Record<string, any> = {
      'api-gateway': {
        service: 'api-gateway',
        avgResponseTime: '45ms',
        p95ResponseTime: '120ms',
        p99ResponseTime: '350ms',
        throughput: '5000 req/s',
        errorRate: '0.05%',
        cpuUsage: '35%',
        memoryUsage: '1.2GB / 4GB',
        lastUpdated: '2026-04-25',
      },
      'database': {
        service: 'database',
        avgQueryTime: '8ms',
        p95QueryTime: '25ms',
        p99QueryTime: '80ms',
        connections: '120 / 500',
        cacheHitRate: '92%',
        diskUsage: '45%',
        lastUpdated: '2026-04-25',
      },
      'auth-service': {
        service: 'auth-service',
        avgResponseTime: '30ms',
        p95ResponseTime: '85ms',
        p99ResponseTime: '200ms',
        throughput: '2000 req/s',
        errorRate: '0.02%',
        tokenCache: '98% hit',
        lastUpdated: '2026-04-26',
      },
    };

    const baseline = mockBaselines[service];
    
    if (!baseline) {
      return `服务 "${service}" 的性能基线未找到。可用服务：${Object.keys(mockBaselines).join('、')}`;
    }

    return `服务 "${service}" 性能基线（截至 ${baseline.lastUpdated}）：
平均响应时间：${baseline.avgResponseTime || baseline.avgQueryTime}
P95 响应时间：${baseline.p95ResponseTime || baseline.p95QueryTime}
P99 响应时间：${baseline.p99ResponseTime || baseline.p99QueryTime}
${baseline.throughput ? `吞吐量：${baseline.throughput}` : ''}
${baseline.errorRate ? `错误率：${baseline.errorRate}` : ''}
${baseline.cpuUsage ? `CPU 使用率：${baseline.cpuUsage}` : ''}
${baseline.memoryUsage ? `内存使用：${baseline.memoryUsage}` : ''}
${baseline.connections ? `数据库连接：${baseline.connections}` : ''}
${baseline.cacheHitRate ? `缓存命中率：${baseline.cacheHitRate}` : ''}`;
  },
  {
    name: 'load_perf_baseline',
    description: '加载服务的性能基线数据，包括响应时间、吞吐量、资源使用等指标',
    schema: z.object({
      service: z.string().describe('服务名称，如"api-gateway"、"database"、"auth-service"'),
    }),
  }
);

/**
 * 工具：检查性能预算
 * 评估新需求对性能的影响是否超出预算
 */
export const checkPerfBudgetTool = tool(
  async ({ reqId, estimatedLoad }: { reqId: string; estimatedLoad: string }) => {
    // Mock 实现：实际项目中应该基于容量规划模型计算
    const loadLower = estimatedLoad.toLowerCase();
    
    if (loadLower.includes('大文件') || loadLower.includes('批量') || loadLower.includes('导入') || loadLower.includes('excel')) {
      return `性能预算评估 - ${reqId}：
⚠️ 预计影响：高
- 该需求涉及大文件或批量操作，预计会显著增加：
  * CPU 使用：+15-25%（文件解析）
  * 内存使用：+500MB-1GB（数据缓存）
  * 磁盘 I/O：峰值可能超过当前容量 2-3 倍
  * 数据库连接：每批次需 5-10 个并发连接
  
建议措施：
1. 使用异步队列处理，避免阻塞主线程
2. 增加文件大小限制（建议 50MB 以内）
3. 分批写入数据库，每批不超过 1000 条
4. 添加限流机制，控制并发上传数`;
    }
    
    if (loadLower.includes('实时') || loadLower.includes('推送') || loadLower.includes('websocket')) {
      return `性能预算评估 - ${reqId}：
⚠️ 预计影响：中高
- 该需求涉及实时通信，预计会增加：
  * WebSocket 连接：+1000-5000 并发连接
  * 内存使用：+200MB-500MB（连接池）
  * 网络带宽：+50-100Mbps（消息推送）
  
建议措施：
1. 使用 Redis Pub/Sub 作为消息中间件
2. 设置连接超时和心跳检测
3. 考虑使用 CDN 分流静态资源`;
    }

    return `性能预算评估 - ${reqId}：
✓ 预计影响：低
- 该需求属于常规功能，性能影响在可接受范围内
- 预计增加：
  * 平均响应时间：+5-15ms
  * 数据库查询：+1-3 次/请求
  * 内存使用：+10-50MB
  
建议：正常推进，但需在上线后监控关键指标`;
  },
  {
    name: 'check_perf_budget',
    description: '检查新需求是否超出性能预算，评估对系统资源的影响',
    schema: z.object({
      reqId: z.string().describe('需求编号'),
      estimatedLoad: z.string().describe('预估负载描述，如"大文件上传"、"实时推送"、"批量导入"'),
    }),
  }
);

// ============================================================================
// 安全专家工具
// ============================================================================

/**
 * 工具：检查安全策略
 * 验证需求是否符合安全规范和策略
 */
export const checkSecurityPolicyTool = tool(
  async ({ reqId, description }: { reqId: string; description: string }) => {
    // Mock 实现：实际项目中应该查询安全策略库
    const descLower = description.toLowerCase();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 检查认证相关
    if (descLower.includes('登录') || descLower.includes('认证') || descLower.includes('密码')) {
      issues.push('涉及用户认证功能');
      recommendations.push('必须使用 HTTPS 加密传输');
      recommendations.push('密码必须使用 bcrypt 或 Argon2 加密存储（禁止明文或 MD5）');
      recommendations.push('实施密码强度策略：至少 8 位，包含大小写、数字和特殊字符');
      recommendations.push('登录失败 5 次后锁定账户 15 分钟');
      recommendations.push('使用 JWT token 并设置合理过期时间（建议 2 小时）');
    }
    
    // 检查数据访问
    if (descLower.includes('查询') || descLower.includes('数据') || descLower.includes('导出')) {
      issues.push('涉及数据访问和查询');
      recommendations.push('必须验证用户权限，遵循最小权限原则');
      recommendations.push('使用参数化查询，防止 SQL 注入');
      recommendations.push('敏感数据（手机号、身份证）需脱敏展示');
      recommendations.push('导出功能需记录操作日志（用户、时间、数据范围）');
    }
    
    // 检查文件操作
    if (descLower.includes('上传') || descLower.includes('文件') || descLower.includes('导入')) {
      issues.push('涉及文件上传功能');
      recommendations.push('限制文件类型（白名单）和大小');
      recommendations.push('文件上传后需病毒扫描');
      recommendations.push('使用随机文件名存储，防止路径遍历攻击');
      recommendations.push('禁止执行上传的文件（如 .exe、.sh）');
    }
    
    // 检查第三方集成
    if (descLower.includes('api') || descLower.includes('第三方') || descLower.includes('接口')) {
      issues.push('涉及外部 API 调用');
      recommendations.push('使用 API 密钥或 OAuth 认证');
      recommendations.push('验证第三方 API 的 SSL 证书');
      recommendations.push('设置请求超时和重试限制');
      recommendations.push('不在客户端暴露 API 密钥');
    }

    if (issues.length === 0) {
      return `安全策略检查 - ${reqId}：
✓ 未发现明显安全风险
建议：
- 遵循 OWASP Top 10 安全实践
- 代码上线前进行安全扫描
- 定期更新依赖库以修复漏洞`;
    }

    return `安全策略检查 - ${reqId}：
⚠️ 发现以下安全关注点：
${issues.map(i => `- ${i}`).join('\n')}

必须遵循的安全要求：
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

合规要求：
- 遵循《网络安全法》和《个人信息保护法》
- 数据处理需获得用户明确同意
- 建立安全事件响应流程`;
  },
  {
    name: 'check_security_policy',
    description: '检查需求是否符合安全策略和规范，识别潜在安全风险',
    schema: z.object({
      reqId: z.string().describe('需求编号'),
      description: z.string().describe('需求功能描述'),
    }),
  }
);

/**
 * 工具：列出认证场景
 * 获取系统支持的认证方式和场景
 */
export const listAuthScenariosTool = tool(
  async () => {
    // Mock 实现：实际项目中应该查询认证配置
    return `当前系统支持的认证场景：

1. 用户名密码登录
   - 支持范围：Web 端、移动端
   - 认证方式：bcrypt 密码哈希 + JWT token
   - Token 有效期：2 小时（可刷新）
   - 双因素认证：可选（短信验证码）

2. OAuth 第三方登录
   - 支持平台：Google、GitHub、微信
   - 实现标准：OAuth 2.0
   - 自动账户关联：基于邮箱

3. API Key 认证（仅限服务端）
   - 使用场景：服务间调用、开放平台
   - 密钥管理：动态生成、定期轮换
   - 权限控制：基于 Scope

4. Session 认证（遗留系统）
   - 使用场景：Admin 后台
   - 存储方式：Redis
   - 有效期：1 天

安全策略：
- 所有认证接口启用速率限制
- 登录失败记录日志并触发告警
- 定期审计认证日志
- 支持强制登出和会话撤销`;
  },
  {
    name: 'list_auth_scenarios',
    description: '列出系统当前支持的所有认证方式和场景，包括认证策略和安全配置',
    schema: z.object({}),
  }
);

// ============================================================================
// 合规专家工具
// ============================================================================

/**
 * 工具：检查合规矩阵
 * 验证需求是否符合行业合规要求
 */
export const checkComplianceMatrixTool = tool(
  async ({ reqId, industry, dataType }: { reqId: string; industry: string; dataType: string }) => {
    // Mock 实现：实际项目中应该查询合规知识库
    const dataTypeLower = dataType.toLowerCase();
    const issues: string[] = [];
    const requirements: string[] = [];
    
    // 检查个人信息处理
    if (dataTypeLower.includes('个人') || dataTypeLower.includes('用户') || dataTypeLower.includes('隐私')) {
      issues.push('涉及个人信息处理');
      requirements.push('《个人信息保护法》：获得用户明确同意，说明收集目的和范围');
      requirements.push('最小化原则：只收集必要的个人信息');
      requirements.push('告知义务：在隐私政策中明确说明数据处理方式');
      requirements.push('用户权利：支持用户查询、更正、删除个人信息');
      requirements.push('安全保障：采取加密、访问控制等安全措施');
    }
    
    // 检查敏感信息
    if (dataTypeLower.includes('身份证') || dataTypeLower.includes('手机') || dataTypeLower.includes('地址')) {
      issues.push('涉及敏感个人信息');
      requirements.push('需获得用户单独同意（不能与其他同意绑定）');
      requirements.push('传输和存储必须加密');
      requirements.push('展示时必须脱敏（如手机号 138****1234）');
      requirements.push('访问需记录审计日志');
    }
    
    // 检查金融相关
    if (industry.toLowerCase().includes('金融') || industry.toLowerCase().includes('支付')) {
      issues.push('金融行业特殊要求');
      requirements.push('遵循《网络安全法》第三级等保要求');
      requirements.push('反洗钱（AML）：交易金额超过限额需上报');
      requirements.push('实名认证：支付账户必须实名制');
      requirements.push('资金安全：使用银行级加密和风控系统');
    }
    
    // 检查医疗健康
    if (industry.toLowerCase().includes('医疗') || industry.toLowerCase().includes('健康')) {
      issues.push('医疗健康行业特殊要求');
      requirements.push('遵循《健康医疗数据管理办法》');
      requirements.push('健康数据必须在境内存储');
      requirements.push('数据访问需医生或患者授权');
      requirements.push('定期备份并保留 5 年以上');
    }

    if (issues.length === 0) {
      return `合规检查 - ${reqId}：
✓ 基础合规要求
- 遵循《网络安全法》基本规范
- 建立数据分类分级管理制度
- 定期进行合规审计
- 建议咨询法务确认具体行业要求`;
    }

    return `合规矩阵检查 - ${reqId}（行业：${industry}）：
⚠️ 合规关注点：
${issues.map(i => `- ${i}`).join('\n')}

必须满足的合规要求：
${requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

建议措施：
- 更新隐私政策和用户协议
- 实施数据分类和标签管理
- 建立合规自查机制
- 与法务部门确认实施细节
- 准备应对监管机构检查的材料`;
  },
  {
    name: 'check_compliance_matrix',
    description: '检查需求是否符合行业合规要求（如个人信息保护法、行业监管政策）',
    schema: z.object({
      reqId: z.string().describe('需求编号'),
      industry: z.string().describe('所属行业，如"互联网"、"金融"、"医疗"、"教育"'),
      dataType: z.string().describe('涉及的数据类型，如"用户个人信息"、"交易数据"、"健康数据"'),
    }),
  }
);

/**
 * 工具：检查数据驻留策略
 * 验证数据存储位置是否符合合规要求
 */
export const checkDataResidencyTool = tool(
  async ({ reqId, dataType, userRegion }: { reqId: string; dataType: string; userRegion: string }) => {
    // Mock 实现：实际项目中应该查询数据驻留政策
    const dataTypeLower = dataType.toLowerCase();
    const regionLower = userRegion.toLowerCase();
    
    if (regionLower.includes('中国') || regionLower.includes('国内')) {
      if (dataTypeLower.includes('个人') || dataTypeLower.includes('用户')) {
        return `数据驻留检查 - ${reqId}：
⚠️ 数据本地化要求
- 《网络安全法》第 37 条：关键信息基础设施运营者在中国境内收集的个人信息必须在境内存储
- 《个人信息保护法》第 40 条：个人信息原则上应在境内存储

当前策略：
- 主存储：阿里云（华东-上海）
- 备份存储：腾讯云（华南-广州）
- 禁止：数据不得直接传输至境外服务器

跨境传输场景（如需）：
1. 必须通过安全评估
2. 获得用户单独同意
3. 与境外接收方签订合同明确保护责任
4. 向监管机构备案

建议：✓ 使用国内云服务，数据不出境`;
      }
    }
    
    if (regionLower.includes('欧洲') || regionLower.includes('eu')) {
      return `数据驻留检查 - ${reqId}：
⚠️ GDPR 要求
- 欧盟用户数据必须在欧盟境内处理或传输至"充分性认定"国家/地区
- 数据处理需合法依据（同意、合同履行、法定义务等）
- 用户享有"被遗忘权"，可要求删除数据

建议措施：
1. 使用 AWS eu-west-1 或 eu-central-1 区域
2. 签署标准合同条款（SCC）
3. 指定数据保护官（DPO）
4. 建立 GDPR 合规流程`;
    }

    return `数据驻留检查 - ${reqId}：
✓ 常规数据存储
- 用户区域：${userRegion}
- 建议使用距离用户最近的云区域以优化性能
- 注意：如涉及跨境传输，需评估目标国家/地区的数据保护法律
- 定期备份数据并测试恢复流程`;
  },
  {
    name: 'check_data_residency',
    description: '检查数据存储位置是否符合数据驻留和跨境传输的合规要求',
    schema: z.object({
      reqId: z.string().describe('需求编号'),
      dataType: z.string().describe('数据类型，如"用户个人信息"、"业务数据"'),
      userRegion: z.string().describe('用户所在地区，如"中国"、"欧洲"、"美国"'),
    }),
  }
);

/**
 * 工具：检查数据保留策略
 * 验证数据保留时长是否符合合规要求
 */
export const checkRetentionPolicyTool = tool(
  async ({ reqId, dataType }: { reqId: string; dataType: string }) => {
    // Mock 实现：实际项目中应该查询数据保留政策
    const dataTypeLower = dataType.toLowerCase();
    
    if (dataTypeLower.includes('日志') || dataTypeLower.includes('审计')) {
      return `数据保留策略检查 - ${reqId}：
📋 审计日志保留要求
- 《网络安全法》要求：网络日志至少保存 6 个月
- 等保三级要求：审计日志保存 1 年以上

当前策略：
- 访问日志：保留 1 年
- 操作日志：保留 2 年
- 安全事件日志：保留 3 年
- 存储方式：热数据 30 天（ES），冷数据归档（OSS）

建议：✓ 当前策略符合要求`;
    }
    
    if (dataTypeLower.includes('个人') || dataTypeLower.includes('用户')) {
      return `数据保留策略检查 - ${reqId}：
📋 个人信息保留要求
- 《个人信息保护法》：达到处理目的或超出保存期限后，应删除或匿名化
- 最小保留原则：不应超出实现目的所需的期限

建议策略：
- 活跃用户数据：账户存续期间
- 注销用户数据：30 天冷静期后删除或匿名化
- 业务数据（如订单）：完成后保留 3 年（财务合规）
- 营销数据（如浏览记录）：6 个月

自动化：
- 实施定期清理任务（每月执行）
- 用户主动注销时立即启动删除流程
- 删除前通知用户并支持数据导出

⚠️ 注意：某些数据需根据其他法规保留（如金融交易记录 5 年）`;
    }
    
    if (dataTypeLower.includes('交易') || dataTypeLower.includes('财务')) {
      return `数据保留策略检查 - ${reqId}：
📋 交易和财务数据保留要求
- 《会计法》：财务数据至少保留 5 年
- 《税收征管法》：涉税资料保存 10 年
- 金融监管：交易记录保留 5 年以上

当前策略：
- 交易记录：保留 7 年
- 发票和凭证：保留 10 年
- 对账单：保留 6 年

建议：✓ 当前策略符合要求
- 使用加密和访问控制保护敏感财务数据
- 建立归档机制（3 年后转冷存储）`;
    }

    return `数据保留策略检查 - ${reqId}：
📋 通用数据保留建议
- 业务数据：根据业务需要确定，一般 1-3 年
- 系统日志：6 个月 - 1 年
- 临时数据：7-30 天

原则：
1. 最小化保留：不保留不必要的数据
2. 分类管理：不同类型数据设置不同保留期
3. 自动清理：实施定期清理机制
4. 合规审计：定期检查保留策略执行情况`;
  },
  {
    name: 'check_retention_policy',
    description: '检查数据保留时长是否符合合规要求（如日志保存、个人信息删除）',
    schema: z.object({
      reqId: z.string().describe('需求编号'),
      dataType: z.string().describe('数据类型，如"审计日志"、"用户个人信息"、"交易记录"'),
    }),
  }
);

/**
 * 导出所有专家工具
 */
export const expertTools = {
  functional: [readFeatureSpecTool],
  performance: [loadPerfBaselineTool, checkPerfBudgetTool],
  security: [checkSecurityPolicyTool, listAuthScenariosTool],
  compliance: [checkComplianceMatrixTool, checkDataResidencyTool, checkRetentionPolicyTool],
};
