// services/chat/test/ui-protocol.spec.ts

import { describe, it, expect } from 'vitest';
import { aiUIResponseSchema, uiActionSchema, uiResponseSchema } from '../src/llm/ui-protocol/ui-schemas';
import { UIActionParser } from '../src/conversation/ui-action.parser';

describe('UI Protocol Schema', () => {
  describe('text Schema', () => {
    it('should parse valid text response', () => {
      const textResponse = {
        type: 'text',
        componentId: 'txt-001',
        content: '# 需求分析报告\n\n这是一份 Markdown 格式的报告。',
      };

      const result = uiResponseSchema.safeParse(textResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('selection Schema', () => {
    it('should parse selection response', () => {
      const selectionResponse = {
        type: 'selection',
        componentId: 'sel-001',
        question: '请选择需求类型：',
        options: [
          { value: 'functional', label: '功能需求', description: null },
          { value: 'non-functional', label: '非功能需求', description: null },
        ],
        multiSelect: false,
        maxSelections: null,
      };

      const result = uiResponseSchema.safeParse(selectionResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid selection (missing question)', () => {
      const invalidSelection = {
        type: 'selection',
        componentId: 'sel-001',
        options: [],
        multiSelect: false,
      };

      const result = uiResponseSchema.safeParse(invalidSelection);
      expect(result.success).toBe(false);
    });
  });

  describe('form Schema', () => {
    it('should parse form response', () => {
      const formResponse = {
        type: 'form',
        componentId: 'form-001',
        title: '需求详细信息',
        description: null,
        fields: [
          { name: 'budget', label: '预算', fieldType: 'number', placeholder: null, required: true, options: null, defaultValue: null, validation: null },
          { name: 'deadline', label: '预期上线时间', fieldType: 'date', placeholder: null, required: true, options: null, defaultValue: null, validation: null },
          { name: 'description', label: '详细描述', fieldType: 'textarea', placeholder: null, required: null, options: null, defaultValue: null, validation: null },
        ],
        groups: null,
      };

      const result = uiResponseSchema.safeParse(formResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('confirmation Schema', () => {
    it('should parse confirmation response', () => {
      const confirmationResponse = {
        type: 'confirmation',
        componentId: 'confirm-001',
        title: '确认开始分析',
        summary: '即将对需求"用户登录功能"进行完整分析',
        impact: '将生成详细的需求分析报告',
        confirmLabel: '确认开始',
        cancelLabel: '取消',
      };

      const result = uiResponseSchema.safeParse(confirmationResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('card Schema', () => {
    it('should parse card response', () => {
      const cardResponse = {
        type: 'card',
        componentId: 'card-001',
        title: '需求详情',
        items: [
          { label: '核心功能', value: '用户登录与注册', highlight: true },
          { label: '目标用户', value: '所有终端用户', highlight: null },
          { label: '优先级', value: 'High', highlight: true },
        ],
        nestedCards: null,
      };

      const result = uiResponseSchema.safeParse(cardResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('steps Schema', () => {
    it('should parse steps response', () => {
      const stepsResponse = {
        type: 'steps',
        componentId: 'steps-001',
        steps: [
          { label: '抽取', status: 'completed', description: null },
          { label: '澄清', status: 'active', description: null },
          { label: '分析', status: 'pending', description: null },
          { label: '风险评估', status: 'pending', description: null },
          { label: '总结', status: 'pending', description: null },
        ],
        currentStep: 1,
      };

      const result = uiResponseSchema.safeParse(stepsResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('table Schema', () => {
    it('should parse table response', () => {
      const tableResponse = {
        type: 'table',
        componentId: 'table-001',
        title: '需求列表',
        columns: [
          { key: 'id', label: 'ID', sortable: true, width: null },
          { key: 'title', label: '标题', sortable: null, width: null },
          { key: 'priority', label: '优先级', sortable: true, width: null },
        ],
        rows: [
          {
            id: 'REQ-001',
            cells: { id: 'REQ-001', title: '用户登录', priority: 'High' },
            actions: null,
          },
          {
            id: 'REQ-002',
            cells: { id: 'REQ-002', title: '密码找回', priority: 'Medium' },
            actions: null,
          },
        ],
      };

      // 注意: table 组件已从 uiResponseSchema 移除 (见 ui-schemas.ts 注释)
      // 这个测试预期会失败
      const result = uiResponseSchema.safeParse(tableResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('action_buttons Schema', () => {
    it('should parse action_buttons response', () => {
      const actionButtonsResponse = {
        type: 'action_buttons',
        componentId: 'actions-001',
        layout: 'horizontal',
        buttons: [
          { action: 'submit', label: '提交', variant: 'primary', disabled: null, confirm: null },
          { action: 'cancel', label: '取消', variant: 'secondary', disabled: null, confirm: null },
        ],
      };

      const result = uiResponseSchema.safeParse(actionButtonsResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('AIUIResponse Schema', () => {
    it('should parse AIUIResponse with multiple messages', () => {
      const aiResponse = {
        messages: [
          {
            type: 'text',
            componentId: 'txt-001',
            content: '好的，开始分析需求。',
          },
          {
            type: 'selection',
            componentId: 'sel-001',
            question: '请选择需求类型：',
            options: [
              { value: 'functional', label: '功能需求', description: null },
            ],
            multiSelect: false,
            maxSelections: null,
          },
        ],
        thinking: '用户想要提需求，我应该先让他们选择需求类型。',
      };

      const result = aiUIResponseSchema.safeParse(aiResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('UIAction Schema', () => {
    it('should parse valid UIAction', () => {
      const action = {
        componentId: 'sel-001',
        action: 'submit',
        data: { selectedOptions: ['functional'] },
        timestamp: '2026-04-15T10:00:00Z',
      };

      const result = uiActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should reject UIAction with invalid action type', () => {
      const invalidAction = {
        componentId: 'sel-001',
        action: 'invalid',
        data: {},
      };

      const result = uiActionSchema.safeParse(invalidAction);
      expect(result.success).toBe(false);
    });
  });

  describe('UIActionParser', () => {
    const parser = new UIActionParser();

    it('should detect and parse valid UIAction', () => {
      const uiAction = {
        componentId: 'sel-001',
        action: 'submit',
        data: { selectedType: 'functional' },
      };

      const lastMetadata = {
        uiStage: 'select_type',
        uiResponse: { messages: [] },
        collectedData: {},
      };

      const result = parser.parse(uiAction, lastMetadata);
      
      expect(result).not.toBeNull();
      expect(result?.uiStage).toBe('select_type');
      expect(result?.userAction?.action).toBe('submit');
      expect(result?.collectedData.selectedType).toBe('functional');
    });

    it('should return null for non-UIAction input', () => {
      const result = parser.parse('just a string message', {});
      expect(result).toBeNull();
    });

    it('should merge collected data from previous stages', () => {
      const uiAction = {
        componentId: 'form-001',
        action: 'submit',
        data: { budget: '50k', timeline: 'Q2' },
      };

      const lastMetadata = {
        uiStage: 'fill_detail',
        collectedData: { selectedType: 'functional' },
      };

      const result = parser.parse(uiAction, lastMetadata);
      
      expect(result?.collectedData.selectedType).toBe('functional');
      expect(result?.collectedData.budget).toBe('50k');
      expect(result?.collectedData.timeline).toBe('Q2');
    });

    it('should throw BadRequestException for invalid UIAction format', () => {
      const invalidAction = {
        componentId: 'test',
        action: 'invalid-action',
        data: {},
      };

      expect(() => parser.parse(invalidAction, {})).toThrow();
    });
  });
});

/**
 * 集成测试：完整的 4 阶段 UI 交互流程
 * 
 * 注意：这些测试需要完整的测试环境（数据库、JWT 认证等）
 * 如果需要运行这些测试，应该在 E2E 测试环境中进行
 * 
 * 测试场景：
 * 1. 用户输入: "我要提一个新需求：批量导入Excel数据"
 *    → 验证返回 selection UI (需求类型选择)
 *    → 验证 metadata.uiStage === 'select_type'
 * 
 * 2. 用户操作: { action: "submit", data: { selectedType: "functional" } }
 *    → 验证返回 form UI (需求详情表单)
 *    → 验证 metadata.uiStage === 'fill_detail'
 * 
 * 3. 用户操作: { action: "submit", data: { budget: "50k", timeline: "Q2" } }
 *    → 验证返回 confirmation + card UI
 *    → 验证 metadata.uiStage === 'confirm'
 * 
 * 4. 用户操作: { action: "confirm" }
 *    → 验证返回 steps + action_buttons UI
 *    → 验证 metadata.uiStage === 'result'
 */
describe.skip('UI Protocol Integration Tests', () => {
  // TODO: 实现完整的 E2E 集成测试
  // 需要设置测试数据库、模拟 JWT 认证、启动完整的 NestJS 应用
  
  it('should complete full 4-stage UI interaction flow', async () => {
    // Stage 1: 初始需求输入
    // Stage 2: 选择需求类型
    // Stage 3: 填写需求详情
    // Stage 4: 确认并查看结果
  });
});
