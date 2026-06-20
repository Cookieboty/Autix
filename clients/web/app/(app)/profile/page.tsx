'use client';

import { ProfileOverviewView } from '@autix/shared-ui/profile';
import {
  useProfilePlatformStatsController,
  useAuthStore,
} from '@autix/shared-store';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { stats } = useProfilePlatformStatsController();

  return <ProfileOverviewView user={user} stats={stats} />;
}
