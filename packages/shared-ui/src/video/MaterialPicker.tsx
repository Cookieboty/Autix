'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, Film, Globe } from 'lucide-react';
import { videoProjectApi } from '@autix/shared-lib';
import { useVideoProjectStore } from '@autix/shared-store';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';

interface MaterialPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  clipId: string;
  projectId: string;
}

type TabId = 'upload' | 'image-gen' | 'video-gen' | 'platform';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'upload', label: '上传', icon: <Upload className="size-3.5" /> },
  { id: 'image-gen', label: '图片产物', icon: <ImageIcon className="size-3.5" /> },
  { id: 'video-gen', label: '视频产物', icon: <Film className="size-3.5" /> },
  { id: 'platform', label: '平台素材', icon: <Globe className="size-3.5" /> },
];

export function MaterialPicker({ open, onOpenChange, role, clipId, projectId }: MaterialPickerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [imageGenItems, setImageGenItems] = useState<any[]>([]);
  const [videoGenItems, setVideoGenItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const { addMaterial } = useVideoProjectStore();

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'image-gen') {
      videoProjectApi.fromImageGenerations({ pageSize: 50 }).then((res) => {
        setImageGenItems((res.data as any)?.items ?? []);
      });
    } else if (activeTab === 'video-gen') {
      videoProjectApi.fromVideoGenerations({ pageSize: 50 }).then((res) => {
        setVideoGenItems((res.data as any)?.items ?? []);
      });
    }
  }, [open, activeTab]);

  const handleSelectItem = useCallback(
    async (url: string, sourceType: string, sourceId?: string, name?: string) => {
      await addMaterial(clipId, { role, sourceType, sourceId, url, name });
      onOpenChange(false);
    },
    [addMaterial, clipId, role, onOpenChange],
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const res = await videoProjectApi.uploadUrl({
          fileName: file.name,
          contentType: file.type,
          folder: 'video-materials',
        });
        const { uploadUrl, publicUrl } = res.data as { uploadUrl: string; publicUrl: string };
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        await addMaterial(clipId, { role, sourceType: 'upload', url: publicUrl, name: file.name });
        onOpenChange(false);
      } finally {
        setUploading(false);
      }
    },
    [addMaterial, clipId, role, onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>选择素材 — {role === 'first_frame' ? '首帧图片' : role === 'reference_image' ? '风格参考' : role === 'reference_video' ? '参考视频' : '背景音频'}</SheetTitle>
        </SheetHeader>

        <div className="flex gap-1 border-b border-border pb-2 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <div className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors">
                <Upload className="size-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">点击或拖拽上传文件</p>
                <input
                  type="file"
                  accept={role === 'reference_audio' ? 'audio/*' : role === 'reference_video' ? 'video/*' : 'image/*'}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>
              {uploading && <p className="text-xs text-muted-foreground">上传中...</p>}
            </div>
          )}

          {activeTab === 'image-gen' && (
            <div className="grid grid-cols-3 gap-2">
              {imageGenItems.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  className="group relative aspect-square overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                  onClick={() => handleSelectItem(item.url ?? item.imageUrl, 'image_generation', item.generationId ?? item.id, item.prompt)}
                >
                  <img src={item.url ?? item.imageUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {imageGenItems.length === 0 && (
                <p className="col-span-3 text-center text-sm text-muted-foreground py-10">暂无图片生成产物</p>
              )}
            </div>
          )}

          {activeTab === 'video-gen' && (
            <div className="grid grid-cols-2 gap-2">
              {videoGenItems.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  className="group relative aspect-video overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-primary/30 transition-all"
                  onClick={() => handleSelectItem(item.videoUrl ?? item.lastFrameUrl, 'video_generation', item.generationId ?? item.id, item.prompt)}
                >
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Film className="size-6 text-muted-foreground" />
                    </div>
                  )}
                </button>
              ))}
              {videoGenItems.length === 0 && (
                <p className="col-span-2 text-center text-sm text-muted-foreground py-10">暂无视频生成产物</p>
              )}
            </div>
          )}

          {activeTab === 'platform' && (
            <div className="text-center text-sm text-muted-foreground py-10">
              平台素材库即将上线
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
