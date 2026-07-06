// 'use client';
//
// import { useEffect, useState } from 'react';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { drawBoardActions } from '@autix/shared-store';
// import { DrawWorkspace } from '@autix/shared-ui/draw';
//
// export default function DrawPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const requestedConversationId = searchParams.get('conversationId');
//   const [boardId, setBoardId] = useState<string | null>(null);
//   const [conversationId, setConversationId] = useState<string | null>(null);
//
//   useEffect(() => {
//     let cancelled = false;
//     (async () => {
//       try {
//         const conversation = await drawBoardActions.ensureConversation(requestedConversationId);
//         const id = await drawBoardActions.ensureBoardForConversation(conversation);
//         if (cancelled) return;
//         setConversationId(conversation.id);
//         setBoardId(id);
//         if (conversation.id !== requestedConversationId) {
//           router.replace(`/draw?conversationId=${conversation.id}`);
//         }
//       } catch {
//         if (!cancelled) {
//           setConversationId('');
//           setBoardId('');
//         }
//       }
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, [requestedConversationId, router]);
//
//   const switchConversation = (nextConversationId: string) => {
//     if (!nextConversationId || nextConversationId === conversationId) return;
//     setBoardId(null);
//     setConversationId(nextConversationId);
//     router.push(`/draw?conversationId=${nextConversationId}`);
//   };
//
//   if (boardId === null || conversationId === null) return null;
//
//   return (
//     <DrawWorkspace
//       key={conversationId}
//       boardId={boardId}
//       conversationId={conversationId}
//       onConversationChange={switchConversation}
//     />
//   );
// }

import { notFound } from 'next/navigation';

export default function DrawPage() {
  notFound();
}
