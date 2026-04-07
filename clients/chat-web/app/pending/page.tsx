'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';

export default function PendingPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0F0F23' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-10 text-center space-y-6"
        style={{
          background: '#1a1a2e',
          border: '1px solid rgba(99,102,241,0.2)',
        }}
      >
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(67,56,202,0.2)', border: '2px solid rgba(99,102,241,0.4)' }}
          >
            <Clock className="w-10 h-10 text-indigo-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">账号审批中</h1>
          <p className="text-indigo-200/60 text-sm leading-relaxed">
            您的账号已提交，正在等待管理员审批。
          </p>
          <p className="text-indigo-200/40 text-sm">审批通过后请重新登录。</p>
        </div>

        <button
          onClick={() => router.push('/login')}
          className="w-full h-11 rounded-xl font-medium text-sm cursor-pointer transition-all"
          style={{
            background: 'transparent',
            border: '1px solid rgba(99,102,241,0.4)',
            color: 'rgba(165,180,252,0.8)',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.8)';
            (e.target as HTMLElement).style.color = 'rgba(165,180,252,1)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)';
            (e.target as HTMLElement).style.color = 'rgba(165,180,252,0.8)';
          }}
        >
          返回登录
        </button>
      </div>
    </div>
  );
}
