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
    const boundInvoke = jest.fn().mockResolvedValue(toolMessage);
    const bindTools = jest.fn().mockReturnValue({ invoke: boundInvoke });
    const fallbackInvoke = jest.fn();

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
