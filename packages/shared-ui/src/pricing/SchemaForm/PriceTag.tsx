import { cn } from '../../ui/utils';

/**
 * spec §6.6: 弱化字重/颜色，紧贴选项；当前选中项高亮。
 * 展示的是 priceOptions() 算出的模型侧价格（不含 taskFixedCost），不是
 * Task 6 quote 接口返回的权威总价——两者允许不同，UI 上是两个独立数字。
 */
export function PriceTag({ price, active }: { price: number; active: boolean }) {
  return (
    <span
      className={cn(
        'text-[10px] tabular-nums',
        active ? 'text-primary/80 font-medium' : 'text-muted-foreground/70',
      )}
    >
      {price}
    </span>
  );
}
