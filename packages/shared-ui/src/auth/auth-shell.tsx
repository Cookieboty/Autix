'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ThemeLogo } from '../brand';

type AuthBrandMarkProps = {
  alt?: string;
  name?: string;
  size?: number;
  priority?: boolean;
  subtitle?: ReactNode;
};

export function AuthBrandMark({
  alt = 'Amux Studio',
  name = 'Amux Studio',
  size = 28,
  priority = false,
  subtitle,
}: AuthBrandMarkProps) {
  return (
    <div>
      <div className="flex items-center justify-center gap-2">
        <ThemeLogo alt={alt} size={size} priority={priority} />
        <span className="text-xl font-bold text-foreground">{name}</span>
      </div>
      {subtitle && <p className="text-foreground/60 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

type AuthFeature = {
  icon: LucideIcon;
  text: ReactNode;
};

type AuthSplitShellProps = {
  brandAlt?: string;
  brandName?: string;
  brandSubtitle?: ReactNode;
  sideTitle: ReactNode;
  sideDescription?: ReactNode;
  sideFooter: ReactNode;
  features?: AuthFeature[];
  mobileSubtitle?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
};

export function AuthSplitShell({
  brandAlt = 'Amux Studio',
  brandName = 'Amux Studio',
  brandSubtitle,
  sideTitle,
  sideDescription,
  sideFooter,
  features,
  mobileSubtitle,
  contentClassName = 'space-y-8',
  children,
}: AuthSplitShellProps) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-background to-secondary">
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/30"
              style={{
                left: `${(i * 17 + 5) % 100}%`,
                top: `${(i * 13 + 10) % 100}%`,
                animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${(i * 0.3) % 2}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <ThemeLogo alt={brandAlt} size={40} priority />
            <div>
              <div className="text-foreground font-bold text-xl">{brandName}</div>
              {brandSubtitle && (
                <div className="text-foreground/60 text-xs">{brandSubtitle}</div>
              )}
            </div>
          </div>
        </div>

        <div className={`relative z-10 ${features?.length ? 'space-y-8' : 'space-y-4'}`}>
          <div>
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              {sideTitle}
            </h2>
            {sideDescription && (
              <p className="mt-3 text-foreground/60 text-sm leading-relaxed">
                {sideDescription}
              </p>
            )}
          </div>
          {features?.length ? (
            <div className="space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <div key={String(text)} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/30 border border-primary/30">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-foreground/80 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative z-10">
          <div className="text-foreground/40 text-xs font-mono">{sideFooter}</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className={`w-full max-w-md ${contentClassName}`}>
          <div className="lg:hidden text-center">
            <AuthBrandMark
              alt={brandAlt}
              name={brandName}
              size={28}
              subtitle={mobileSubtitle}
            />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

type AuthCenteredShellProps = {
  children: ReactNode;
  className?: string;
};

export function AuthCenteredShell({ children, className = 'space-y-8' }: AuthCenteredShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-background">
      <div className={`w-full max-w-md ${className}`}>{children}</div>
    </div>
  );
}

type AuthPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  showBrand?: boolean;
  brandAlt?: string;
  brandName?: string;
};

export function AuthPageHeader({
  title,
  description,
  showBrand = true,
  brandAlt = 'Amux Studio',
  brandName = 'Amux Studio',
}: AuthPageHeaderProps) {
  return (
    <div className="text-center">
      {showBrand && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <ThemeLogo alt={brandAlt} size={28} />
          <span className="text-xl font-bold text-foreground">{brandName}</span>
        </div>
      )}
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {description && (
        <p className="text-foreground/50 text-sm mt-2">{description}</p>
      )}
    </div>
  );
}
