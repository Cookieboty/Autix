'use client';

/**
 * 作者头像。
 *
 * 没有头像时**不留白、也不放一个通用小人图标** —— 而是画一个实心圆，填昵称首字母。
 * 圆形区域必须看得见（有底色），否则「没头像」看起来像「头像挂了」。
 */
export function AuthorAvatar({
  name,
  avatarUrl,
  className = 'size-5',
  textClassName = 'text-[10px]',
}: {
  name: string;
  avatarUrl?: string | null;
  /** 尺寸类（size-5 / size-8 …） */
  className?: string;
  /** 首字母字号类，随尺寸调 */
  textClassName?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} ${textClassName} grid shrink-0 place-items-center rounded-full bg-growth-accent font-black uppercase text-background`}
    >
      {authorInitial(name)}
    </span>
  );
}

/** 昵称首字母；空名字兜底 'A'（Amux）。中文昵称取第一个字，本来就是「首字母」的合理解。 */
export function authorInitial(name: string): string {
  return (name.trim()[0] || 'A').toUpperCase();
}
