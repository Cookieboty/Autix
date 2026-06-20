const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

export function splitErrorMessage(
  raw: string,
  fallbackTitle: string,
): { title: string; body: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { title: fallbackTitle, body: '' };
  const m = trimmed.match(/^([^.。\n(]{0,80})([.。\n(][\s\S]*)?$/);
  if (m && m[2]) {
    return { title: m[1].trim(), body: m[2].replace(/^[.。\n]\s*/, '').trim() };
  }
  return {
    title: trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
    body: '',
  };
}

export function ErrorMessageBody({ message }: { message: string }) {
  if (!message) return null;
  const parts = message.split(URL_PATTERN);
  return (
    <p className="break-all">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-destructive"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}
