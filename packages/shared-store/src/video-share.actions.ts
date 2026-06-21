import {
  videoProjectApi,
  type VideoProjectShareDetail,
  type VideoProjectShareLinkResult,
} from '@autix/sdk';

export type {
  VideoProjectShareClip,
  VideoProjectShareDetail,
  VideoProjectShareLinkResult,
} from '@autix/sdk';

export const videoShareActions = {
  createShare: async (projectId: string): Promise<VideoProjectShareLinkResult> => {
    const res = await videoProjectApi.createShare(projectId);
    return res.data;
  },
  getSharedProject: async (code: string): Promise<VideoProjectShareDetail> => {
    const res = await videoProjectApi.getShared(code);
    return res.data;
  },
};
