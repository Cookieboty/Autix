import { AIMessage } from '@langchain/core/messages';
import {
  invokeModelWithImageActionTools,
  parseImageToolActionFromMessage,
  parseImageToolActionFromText,
} from './image-tool-actions';

describe('image tool actions', () => {
  it('extracts native generate_image tool calls from the main LLM message', () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'call-1',
          name: 'generate_image',
          args: {
            prompt: 'A cinematic city skyline',
            reasoning: '用户明确要求生成图片',
          },
          type: 'tool_call',
        },
      ],
    });

    expect(parseImageToolActionFromMessage(message)).toEqual({
      type: 'generate_image',
      prompt: 'A cinematic city skyline',
      reasoning: '用户明确要求生成图片',
    });
  });

  it('binds native image action tools before invoking supported chat models', async () => {
    const toolMessage = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'call-1',
          name: 'edit_image',
          args: { instruction: 'Change the background to blue' },
          type: 'tool_call',
        },
      ],
    });
    const boundInvoke = vi.fn().mockResolvedValue(toolMessage);
    const bindTools = vi.fn().mockReturnValue({ invoke: boundInvoke });
    const fallbackInvoke = vi.fn();

    const result = await invokeModelWithImageActionTools(
      { bindTools, invoke: fallbackInvoke } as never,
      '把背景改成蓝色',
    );

    expect(bindTools).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'generate_image' }),
        expect.objectContaining({ name: 'edit_image' }),
      ]),
      { tool_choice: 'auto' },
    );
    expect(boundInvoke).toHaveBeenCalledWith('把背景改成蓝色');
    expect(fallbackInvoke).not.toHaveBeenCalled();
    expect(result).toEqual({ message: toolMessage, usedNativeTools: true });
  });

  it('degrades to a plain no-tools invoke when the tools request fails with an opaque error', async () => {
    // 模拟不支持 function calling 的网关：绑定 tools 后 invoke 抛出 LangChain 的隐晦 TypeError。
    const boundInvoke = vi
      .fn()
      .mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'message')"));
    const bindTools = vi.fn().mockReturnValue({ invoke: boundInvoke });
    const plainMessage = new AIMessage({ content: '这是一段普通回复' });
    const fallbackInvoke = vi.fn().mockResolvedValue(plainMessage);

    const result = await invokeModelWithImageActionTools(
      { bindTools, invoke: fallbackInvoke } as never,
      '帮我画一只猫',
    );

    expect(boundInvoke).toHaveBeenCalledTimes(1);
    expect(fallbackInvoke).toHaveBeenCalledWith('帮我画一只猫');
    expect(result).toEqual({ message: plainMessage, usedNativeTools: false });
  });

  it('propagates the underlying error when the no-tools fallback also fails', async () => {
    const bindTools = vi.fn().mockReturnValue({
      invoke: vi.fn().mockRejectedValue(new TypeError('opaque tools error')),
    });
    const fallbackInvoke = vi.fn().mockRejectedValue(new Error('401 unauthorized'));

    await expect(
      invokeModelWithImageActionTools({ bindTools, invoke: fallbackInvoke } as never, 'hi'),
    ).rejects.toThrow('401 unauthorized');
  });

  it('keeps JSON text parsing as a compatibility fallback', () => {
    expect(parseImageToolActionFromText(
      '好的，调用工具：{"type":"generate_image","prompt":"a cat","reasoning":"明确生图"}',
    )).toEqual({
      type: 'generate_image',
      prompt: 'a cat',
      reasoning: '明确生图',
    });
  });
});
