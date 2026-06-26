import { publicGrowthActions } from './public-growth.actions';

export type {
  PublicCreationMediaType,
  PublicGrowthMediaItem,
  PublicPromptVisibility,
  PublishPublicCreationInput,
} from './public-growth.actions';

export const publicCreationActions = {
  get: publicGrowthActions.getCreation,
  list: publicGrowthActions.listCreations,
  recordView: publicGrowthActions.recordView,
  like: publicGrowthActions.likeCreation,
  recordShare: publicGrowthActions.recordShare,
  publishImageGeneration: publicGrowthActions.publishImageGeneration,
  publishVideoProject: publicGrowthActions.publishVideoProject,
};
