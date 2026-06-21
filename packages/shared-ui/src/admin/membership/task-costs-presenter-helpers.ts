export function getStatusBadgePresentation({
  active,
  missing = false,
  activeText,
  inactiveText,
  missingText,
}: {
  active?: boolean;
  missing?: boolean;
  activeText: string;
  inactiveText: string;
  missingText?: string;
}) {
  return {
    label: missing ? missingText : active !== false ? activeText : inactiveText,
    color: missing
      ? 'var(--danger)'
      : active !== false
        ? 'var(--success)'
        : 'var(--muted)',
    backgroundColor: missing
      ? 'var(--danger-soft)'
      : active !== false
        ? 'var(--success-soft)'
        : 'var(--muted-soft)',
  };
}
