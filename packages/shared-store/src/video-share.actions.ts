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
  getSharedProject: async (token: string): Promise<VideoProjectShareDetail> => {
    const res = await videoProjectApi.getShared(token);
    return res.data;
  },
};
