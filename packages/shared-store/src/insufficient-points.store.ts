import { create } from 'zustand';
import {
  registerInsufficientPointsReporter,
  type InsufficientPointsEvent,
} from '@autix/sdk';

export interface InsufficientPointsPayload extends InsufficientPointsEvent {
  triggeredAt: number;
}

interface InsufficientPointsState {
  open: boolean;
  payload: InsufficientPointsPayload | null;
  openDialog: (payload: InsufficientPointsPayload) => void;
  closeDialog: () => void;
}

export const useInsufficientPointsStore = create<InsufficientPointsState>((set) => ({
  open: false,
  payload: null,
  openDialog: (payload) => set({ open: true, payload }),
  closeDialog: () => set({ open: false }),
}));

let wired = false;

export function wireInsufficientPointsReporter(): () => void {
  if (wired) {
    return () => {
      wired = false;
      registerInsufficientPointsReporter(null);
    };
  }
  wired = true;
  registerInsufficientPointsReporter((event) => {
    useInsufficientPointsStore.getState().openDialog({
      ...event,
      triggeredAt: Date.now(),
    });
  });
  return () => {
    wired = false;
    registerInsufficientPointsReporter(null);
  };
}
