import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignActions } from './campaign.actions';

export const campaignQueryKeys = {
  root: () => ['campaign'] as const,
  homeStarter: () => [...campaignQueryKeys.root(), 'home-starter'] as const,
};

export function useHomeStarterTasksQuery(enabled = true) {
  return useQuery({
    queryKey: campaignQueryKeys.homeStarter(),
    queryFn: campaignActions.getHomeStarterTasks,
    enabled,
  });
}

export function useClaimHomeStarterTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: campaignActions.claimHomeStarterTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: campaignQueryKeys.homeStarter(),
      });
    },
  });
}
