'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MembershipPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/membership/benefits');
  }, [router]);

  return null;
}
