'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Card, CardContent, Button } from '@heroui/react';

export default function PendingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md bg-secondary border border-border">
        <CardContent className="text-center space-y-6 py-12">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-warning/20 border-2 border-warning/40">
              <Clock className="w-10 h-10 text-warning" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">账号审批中</h1>
            <p className="text-foreground/60 text-sm leading-relaxed">
              您的账号已提交，正在等待管理员审批。
            </p>
            <p className="text-foreground/40 text-sm">审批通过后请重新登录。</p>
          </div>

          <Button
            onPress={() => router.push('/login')}
            className="w-full cursor-pointer font-medium"
            variant="primary"
            size="lg"
          >
            返回登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
