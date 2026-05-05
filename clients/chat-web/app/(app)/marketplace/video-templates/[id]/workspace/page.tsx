'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@autix/shared-ui';
import { ArrowLeft } from 'lucide-react';
import { useVideoGenerationStore } from '@autix/shared-store';
import { appendConversationMessage } from '@autix/shared-lib';

/**
 * 视频模板生成工作区(骨架版)
 * 当前阶段视频模型未对接,先提供基础流程:扣分 + 创建生成记录 + 占位 UI。
 * 多轮精修与图片版一致,模型对接后再补具体调用。
 */
export default function VideoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversationId');
  const { currentGeneration: gen, fetchGeneration } = useVideoGenerationStore();

  useEffect(() => {
    if (id) fetchGeneration(id);
  }, [id, fetchGeneration]);

  if (!gen) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-6">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          视频生成工作区(模型对接中)
        </p>
        <Button
          variant="ghost"
          onClick={() => router.push(`/marketplace/video-templates/${id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回详情
        </Button>
      </div>
    );
  }

  const sendToConversation = async () => {
    if (!conversationId) return;
    await appendConversationMessage(conversationId, {
      role: 'USER',
      content: `我创建了一个视频模板生成任务，继续基于这个提示词讨论。\n\n提示词：${gen.resolvedPrompt}`,
      metadata: {
        source: 'video_template_generation',
        generationId: gen.id,
        templateId: gen.templateId,
      },
    });
    router.push(`/c/${conversationId}`);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <aside
        className="w-[300px] flex-shrink-0 overflow-y-auto p-4 space-y-4"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <Button
          variant="ghost"
          onClick={() => router.push(`/marketplace/video-templates/${gen.templateId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> 返回详情
        </Button>
        {conversationId && (
          <Button  onClick={sendToConversation}>
            发送到当前会话
          </Button>
        )}

        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>
            模板
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {(gen as { template?: { title?: string } }).template?.title ?? gen.templateId}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>
            提示词
          </p>
          <pre
            className="p-3 rounded-md text-xs whitespace-pre-wrap"
            style={{
              backgroundColor: 'var(--panel-muted)',
              color: 'var(--foreground)',
              fontFamily: 'monospace',
              border: '1px solid var(--border)',
            }}
          >
            {gen.resolvedPrompt}
          </pre>
        </div>
      </aside>

      <div className="flex-1 flex items-center justify-center">
        <div
          className="text-center px-8 py-12 rounded-lg max-w-md"
          style={{
            backgroundColor: 'var(--panel-muted)',
            border: '2px dashed var(--border)',
          }}
        >
          <p
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            视频生成模型尚未对接
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            生成记录已创建并扣减积分。模型对接后将补全完整流程。
          </p>
        </div>
      </div>
    </div>
  );
}
