'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MembershipPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile?tab=membership');
  }, [router]);

  return null;
}
