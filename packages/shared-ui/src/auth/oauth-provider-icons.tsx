'use client';

import type { SVGProps } from 'react';
import { Mail } from 'lucide-react';
import type { OAuthProviderId } from './types';

type ProviderIconProps = SVGProps<SVGSVGElement> & {
  provider: OAuthProviderId;
};

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.73-.07-1.43-.19-2.1H12v3.98h5.38a4.6 4.6 0 0 1-1.99 3.02v2.5h3.23c1.89-1.74 2.98-4.3 2.98-7.4z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.91a6 6 0 0 1 0-3.82V7.51H3.06a10 10 0 0 0 0 8.98l3.34-2.58z"
      />
      <path
        fill="#EA4335"
        d="M12 5.97c1.47 0 2.78.5 3.81 1.49l2.87-2.87C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.51l3.34 2.58C7.19 7.73 9.4 5.97 12 5.97z"
      />
    </svg>
  );
}

function AppleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M16.4 12.83c-.02-2.12 1.74-3.14 1.82-3.19-1-.1-2.56-.08-3.62 1.12-.94 1.06-1.78 1.1-2.72.16-.91-.92-2.02-.9-2.92-.78-1.92.26-3.75 1.94-3.75 5.04 0 1.55.57 3.17 1.28 4.28.62.97 1.37 2.06 2.35 2.02.94-.04 1.3-.62 2.44-.62s1.46.62 2.46.6c1.02-.02 1.66-.99 2.28-1.96.72-1.12 1.02-2.2 1.04-2.25-.02-.01-1.98-.76-2-2.99zM14.23 6.97c.52-.63.87-1.5.78-2.37-.75.03-1.65.5-2.18 1.12-.48.56-.9 1.45-.78 2.3.83.06 1.66-.42 2.18-1.05z"
      />
    </svg>
  );
}

function MicrosoftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.38-3.37-1.38-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.36 9.36 0 0 1 12 6.96c.85 0 1.7.12 2.5.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.2 10.2 0 0 0 22 12.25C22 6.59 17.52 2 12 2z"
      />
    </svg>
  );
}

export function OAuthProviderIcon({
  provider,
  className = 'size-5',
  ...props
}: ProviderIconProps) {
  if (provider === 'google') return <GoogleIcon className={className} {...props} />;
  if (provider === 'apple') return <AppleIcon className={className} {...props} />;
  if (provider === 'microsoft') return <MicrosoftIcon className={className} {...props} />;
  return <GitHubIcon className={className} {...props} />;
}

export function EmailProviderIcon({ className = 'size-5' }: { className?: string }) {
  return <Mail className={className} aria-hidden="true" />;
}
