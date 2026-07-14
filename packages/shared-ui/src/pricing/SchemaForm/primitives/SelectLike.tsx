import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { cn } from '../../../ui/utils';

export function SelectLike({
  value,
  options,
  onChange,
  compact = false,
  className,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          'w-full border-border bg-background px-3 text-xs shadow-none',
          compact ? 'h-8' : 'h-9',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[70] rounded-lg">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
