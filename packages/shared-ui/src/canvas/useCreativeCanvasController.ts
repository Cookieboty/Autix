'use client';

import { useEffect, useMemo } from 'react';
import { useCanvasBoardStore } from '@autix/shared-store';
import {
  type CanvasActionType,
  type CanvasNode,
  resolveCanvasActionAvailability,
} from '@autix/domain';

export interface CreativeCanvasControllerOptions {
  boardId: string;
  /** Default image model config used when generating from the canvas. */
  modelConfigId: string;
}

export function useCreativeCanvasController({ boardId, modelConfigId }: CreativeCanvasControllerOptions) {
  const store = useCanvasBoardStore();
  const {
    state,
    selectedNodeIds,
    entitlement,
    estimate,
    runningActions,
    saveStatus,
    dirty,
    errorMessage,
    load,
    reset,
    setSelection,
    applyLocalChange,
    undo,
    redo,
    generateImage,
    fetchEstimate,
  } = store;

  useEffect(() => {
    void load(boardId);
    return () => reset();
  }, [boardId, load, reset]);

  const availability = useMemo(
    () => resolveCanvasActionAvailability(state, selectedNodeIds, entitlement),
    [state, selectedNodeIds, entitlement],
  );

  // Preview cost whenever an image-generate becomes available for the selection.
  useEffect(() => {
    const gen = availability.find((a) => a.actionType === 'image-generate' && a.available);
    if (gen) void fetchEstimate('image-generate', selectedNodeIds, modelConfigId);
  }, [availability, selectedNodeIds, modelConfigId, fetchEstimate]);

  const moveNode = (id: string, x: number, y: number) => {
    applyLocalChange((s) => ({
      ...s,
      nodes: s.nodes.map((n: CanvasNode) => (n.id === id ? { ...n, x, y } : n)),
    }));
  };

  const runAction = (actionType: CanvasActionType) => {
    if (actionType === 'image-generate') {
      void generateImage({ selectedNodeIds, modelConfigId });
    }
    // video/storyboard/agent actions land in Phase 2/3.
  };

  return {
    state,
    selectedNodeIds,
    entitlement,
    estimate,
    runningActions,
    saveStatus,
    dirty,
    errorMessage,
    availability,
    setSelection,
    moveNode,
    undo,
    redo,
    runAction,
  };
}
