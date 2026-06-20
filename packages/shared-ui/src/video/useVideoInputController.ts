'use client';

import { useCallback, useState } from 'react';
import type { FrameSlot, VideoMaterial } from './VideoInputArea';
import type { VideoGenMode } from './VideoToolbar';
import {
  createEmptyVideoFrame,
  createVideoFramesFromImages,
  createVideoMaterialFromFile,
  createVideoTemplateMaterials,
  DEFAULT_VIDEO_FRAME_DURATION,
  isImageMaterial,
  placeVideoMaterialInFrames,
  swapFirstLastVideoFrames,
} from './video-input-utils';

interface UseVideoInputControllerOptions {
  defaultMode?: VideoGenMode;
  defaultDuration?: number;
  appendAdditionalFirstLastWhenFull?: boolean;
  pasteEnabled?: boolean;
}

export function useVideoInputController({
  defaultMode = 'reference',
  defaultDuration = DEFAULT_VIDEO_FRAME_DURATION,
  appendAdditionalFirstLastWhenFull = true,
  pasteEnabled = true,
}: UseVideoInputControllerOptions = {}) {
  const [mode, setModeRaw] = useState<VideoGenMode>(defaultMode);
  const [model, setModel] = useState('');
  const [ratio, setRatio] = useState('adaptive');
  const [duration, setDuration] = useState(defaultDuration);
  const [materials, setMaterials] = useState<VideoMaterial[]>([]);
  const [frames, setFrames] = useState<FrameSlot[]>([
    createEmptyVideoFrame('frame-1', DEFAULT_VIDEO_FRAME_DURATION),
    createEmptyVideoFrame('frame-2', DEFAULT_VIDEO_FRAME_DURATION),
  ]);

  const getImageMaterialsForModeSwitch = useCallback(
    () => (
      mode === 'reference'
        ? materials
        : frames.map((frame) => frame.material)
    ).filter(isImageMaterial),
    [frames, materials, mode],
  );

  const setMode = useCallback(
    (nextMode: VideoGenMode) => {
      if (nextMode === mode) return;
      const imageMaterials = getImageMaterialsForModeSwitch();
      setModeRaw(nextMode);
      if (nextMode === 'reference') {
        setMaterials(imageMaterials);
      } else {
        setFrames(createVideoFramesFromImages(imageMaterials, nextMode));
      }
    },
    [getImageMaterialsForModeSwitch, mode],
  );

  const applyRefs = useCallback(
    (refs: string[], targetMode = mode) => {
      const nextMaterials = createVideoTemplateMaterials(refs);
      if (targetMode === 'reference') {
        setMaterials(nextMaterials);
      } else {
        setFrames(createVideoFramesFromImages(nextMaterials, targetMode));
      }
    },
    [mode],
  );

  const resetFramesForMode = useCallback((targetMode: VideoGenMode) => {
    setFrames(
      targetMode === 'reference'
        ? createVideoFramesFromImages([], 'first_last_frame')
        : createVideoFramesFromImages([], targetMode),
    );
  }, []);

  const resetInputsForTemplateMode = useCallback((targetMode: VideoGenMode, refs: string[] = []) => {
    const nextMaterials = createVideoTemplateMaterials(refs);
    setModeRaw(targetMode);
    if (targetMode === 'reference') {
      setMaterials(nextMaterials);
      setFrames(createVideoFramesFromImages([], 'first_last_frame'));
    } else {
      setMaterials([]);
      setFrames(createVideoFramesFromImages(nextMaterials, targetMode));
    }
  }, []);

  const clearInputs = useCallback(() => {
    setMaterials([]);
    setFrames(createVideoFramesFromImages([], 'first_last_frame'));
  }, []);

  const addMaterials = useCallback((files: File[]) => {
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        const material = createVideoMaterialFromFile(file, url, {
          allowAudio: true,
          idSuffix: `-${Math.random().toString(36).slice(2)}`,
        });
        setMaterials((prev) => [...prev, material]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setMaterials((prev) => prev.filter((material) => material.id !== id));
  }, []);

  const addFrame = useCallback(() => {
    setFrames((prev) => [...prev, createEmptyVideoFrame()]);
  }, []);

  const removeFrame = useCallback((id: string) => {
    setFrames((prev) => prev.filter((frame) => frame.id !== id));
  }, []);

  const clearFrames = useCallback(() => {
    setFrames([createEmptyVideoFrame('frame-1')]);
  }, []);

  const swapFirstLastFrames = useCallback(() => {
    setFrames((prev) => swapFirstLastVideoFrames(prev));
  }, []);

  const setFrameFile = useCallback((frameId: string, files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const material = createVideoMaterialFromFile(file, url, { allowAudio: false });
      setFrames((prev) =>
        prev.map((frame) =>
          frame.id === frameId ? { ...frame, material } : frame,
        ),
      );
    };
    reader.readAsDataURL(file);
  }, []);

  const pasteFiles = useCallback(
    (files: File[]) => {
      if (!pasteEnabled) return;

      files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string;
          const material = createVideoMaterialFromFile(file, url, {
            allowAudio: true,
            idSuffix: `-${Math.random().toString(36).slice(2)}`,
          });

          if (mode === 'reference') {
            setMaterials((prev) => [...prev, material]);
            return;
          }

          setFrames((prev) =>
            placeVideoMaterialInFrames(prev, material, mode, {
              appendWhenFull:
                mode !== 'first_last_frame' ||
                (appendAdditionalFirstLastWhenFull && index > 0),
              frameIdSuffix: index > 0 ? `-${index}` : '',
            }),
          );
        };
        reader.readAsDataURL(file);
      });
    },
    [appendAdditionalFirstLastWhenFull, mode, pasteEnabled],
  );

  return {
    mode,
    setMode,
    setModeRaw,
    model,
    setModel,
    ratio,
    setRatio,
    duration,
    setDuration,
    materials,
    setMaterials,
    frames,
    setFrames,
    applyRefs,
    resetFramesForMode,
    resetInputsForTemplateMode,
    clearInputs,
    addMaterials,
    removeMaterial,
    addFrame,
    removeFrame,
    clearFrames,
    swapFirstLastFrames,
    setFrameFile,
    pasteFiles,
  };
}
