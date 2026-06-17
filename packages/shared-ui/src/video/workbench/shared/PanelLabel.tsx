import type React from 'react';

export function PanelLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}
