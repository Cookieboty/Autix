import {
  featuredSlotsAdminApi,
  type CreateFeaturedSlotInput,
  type FeaturedSlot,
  type FeaturedSlotCandidate,
  type FeaturedSlotCandidateResourceType,
  type UpdateFeaturedSlotInput,
} from '@autix/sdk';

export type {
  CreateFeaturedSlotInput,
  FeaturedSlot,
  FeaturedSlotCandidate,
  FeaturedSlotCandidateResourceType,
  UpdateFeaturedSlotInput,
};
export type { FeaturedSlotKind } from '@autix/sdk';

export const featuredSlotsAdminActions = {
  list: async (placement: string): Promise<FeaturedSlot[]> => {
    const { data } = await featuredSlotsAdminApi.list(placement);
    return data;
  },
  candidates: async (
    resourceType: FeaturedSlotCandidateResourceType,
    query?: string,
  ): Promise<FeaturedSlotCandidate[]> => {
    const { data } = await featuredSlotsAdminApi.candidates(resourceType, query);
    return data;
  },
  create: (data: CreateFeaturedSlotInput) => featuredSlotsAdminApi.create(data),
  update: (id: string, data: UpdateFeaturedSlotInput) =>
    featuredSlotsAdminApi.update(id, data),
  remove: (id: string) => featuredSlotsAdminApi.remove(id),
  reorder: (placement: string, orderedIds: string[]) =>
    featuredSlotsAdminApi.reorder(placement, orderedIds),
};
