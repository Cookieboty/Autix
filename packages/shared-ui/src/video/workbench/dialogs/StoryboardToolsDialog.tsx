import { Layers, Loader2, SlidersHorizontal, Sparkles, Wrench } from 'lucide-react';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { DEFAULT_VIDEO_PARAMS, STORYBOARD_PRESETS } from '../constants';
import { PanelLabel } from '../shared/PanelLabel';

export function StoryboardToolsDialog({
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  clipCount,
  onClipCountChange,
  params,
  loading,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  clipCount: number;
  onClipCountChange: (count: number) => void;
  params: Record<string, unknown>;
  loading: boolean;
  onGenerate: () => void;
}) {
  const normalizedClipCount = String(clipCount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4" />
            分镜脚本工具
          </DialogTitle>
          <DialogDescription>
            携带视频创意、右侧参数和分镜数量，让 LLM 直接生成对应分镜脚本。
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[72vh] space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">视频创意 / Prompt</span>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:border-primary"
              placeholder="输入视频主题、故事、风格、主体动作、镜头节奏等。也可以从底部 Prompt Chat 直接带入。"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
            />
          </label>

          <section className="space-y-2">
            <PanelLabel icon={<Layers className="size-3.5" />} label="分镜数量" />
            <div className="grid gap-2 sm:grid-cols-4">
              {STORYBOARD_PRESETS.map((preset) => (
                <button
                  key={preset.count}
                  type="button"
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left transition-colors',
                    clipCount === preset.count
                      ? 'border-primary bg-primary/8'
                      : 'border-border bg-background hover:border-primary/45 hover:bg-accent',
                  )}
                  onClick={() => onClipCountChange(preset.count)}
                >
                  <div className="text-sm font-medium">{preset.label}</div>
                  <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </div>
            <Select value={normalizedClipCount} onValueChange={(value) => onClipCountChange(Number(value))}>
              <SelectTrigger className="h-9 w-full border-border bg-background px-3 text-xs shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[70] rounded-lg">
                {[2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
                  <SelectItem key={count} value={String(count)} className="text-xs">
                    {count} 个分镜
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-lg border border-border bg-muted/20 p-3">
            <PanelLabel icon={<SlidersHorizontal className="size-3.5" />} label="将携带的生成参数" />
            <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>时长：{String(params.duration ?? DEFAULT_VIDEO_PARAMS.duration)}s</div>
              <div>分辨率：{String(params.resolution ?? DEFAULT_VIDEO_PARAMS.resolution)}</div>
              <div>比例：{String(params.ratio ?? DEFAULT_VIDEO_PARAMS.ratio)}</div>
              <div>音频：{params.generateAudio === false || params.generate_audio === false ? '无声' : '有声'}</div>
            </div>
          </section>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              取消
            </Button>
          </DialogClose>
          <Button type="button" className="gap-1.5" disabled={!prompt.trim() || loading} onClick={onGenerate}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            生成分镜脚本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
