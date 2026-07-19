import { create } from 'zustand';
import {
  registerInsufficientPointsReporter,
  type InsufficientPointsEvent,
} from '@autix/sdk';

/**
 * 拦截上下文：被拦下的到底是「什么」。
 * 拦截事件由 SDK 的 HTTP 层抛出，那一层只有 url/method，拿不到用户点的是哪个模型，
 * 所以由发起方（生成器）在请求前登记，弹框据此把标题写成「解锁 XXX」而不是干巴巴的「积分不足」。
 */
export interface BillingGateContext {
  /** 触发拦截的功能展示名，通常是模型名，如 "Seedance 2.0" */
  featureName?: string;
}

export interface InsufficientPointsPayload extends InsufficientPointsEvent {
  triggeredAt: number;
  /** 触发那一刻的上下文快照 */
  context?: BillingGateContext;
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

/**
 * 当前拦截上下文。刻意放在 store 之外的模块级变量：它不驱动渲染，
 * 只在拦截发生的瞬间被快照进 payload，放进 zustand 反而会引入无谓的重渲染。
 */
let gateContext: BillingGateContext | null = null;

/** 发起可能被计费拦截的操作前调用，登记「这次是为了什么」 */
export function setBillingGateContext(context: BillingGateContext | null): void {
  gateContext = context;
}

export function getBillingGateContext(): BillingGateContext | null {
  return gateContext;
}

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
      context: gateContext ?? undefined,
    });
  });
  return () => {
    wired = false;
    registerInsufficientPointsReporter(null);
  };
}
