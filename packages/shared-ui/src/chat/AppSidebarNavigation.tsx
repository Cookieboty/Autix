'use client';

import * as React from 'react';
import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from 'lucide-react';

import { ThemeLogo } from '../brand';
import { Link } from '../navigation';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/sidebar';
import type { AppSidebarNavGroup, AppSidebarNavItem } from './AppSidebar';

function SidebarNavButton({
  label,
  icon: Icon,
  href,
  action,
  active,
  className,
  labelClassName,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
  action?: () => void;
  active?: boolean;
  className?: string;
  labelClassName?: string;
}) {
  const content = (
    <>
      <Icon />
      <span className={labelClassName}>{label}</span>
    </>
  );

  if (action) {
    return (
      <SidebarMenuButton
        tooltip={label}
        isActive={active}
        type="button"
        onClick={action}
        className={className}
      >
        {content}
      </SidebarMenuButton>
    );
  }

  if (href) {
    return (
      <SidebarMenuButton
        tooltip={label}
        isActive={active}
        asChild
        className={className}
      >
        <Link href={href} aria-current={active ? 'page' : undefined}>
          {content}
        </Link>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton
      tooltip={label}
      isActive={active}
      type="button"
      disabled
      className={className}
    >
      {content}
    </SidebarMenuButton>
  );
}

function SidebarCollapseButton({
  collapseLabel,
  expandLabel,
}: {
  collapseLabel: string;
  expandLabel: string;
}) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const Icon = collapsed ? ChevronsRight : ChevronsLeft;
  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <SidebarMenuButton
      tooltip={label}
      type="button"
      aria-label={label}
      onClick={toggleSidebar}
      className="ml-1 size-8 shrink-0 justify-center rounded-lg text-sidebar-foreground/62 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:ml-0"
    >
      <Icon className="size-4" />
      <span className="sr-only">{label}</span>
    </SidebarMenuButton>
  );
}

export function AppSidebarHeader({
  brandLabel,
  homeHref,
  collapseLabel,
  expandLabel,
  onNavigateHome,
}: {
  brandLabel: string;
  homeHref: string;
  collapseLabel: string;
  expandLabel: string;
  onNavigateHome: () => void;
}) {
  return (
    <SidebarHeader className="px-3 pt-4 group-data-[collapsible=icon]:p-1.5">
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex min-w-0 items-center gap-1">
            <SidebarMenuButton
              size="lg"
              asChild
              className="min-w-0 rounded-lg border border-white/12 bg-white/[0.06] text-white shadow-[0_14px_40px_rgba(0,0,0,0.24)] transition-colors hover:bg-white/[0.09] group-data-[collapsible=icon]:hidden"
            >
              <a
                href={homeHref}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigateHome();
                }}
              >
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <ThemeLogo alt={brandLabel} size={32} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-base font-semibold tracking-tight">
                    {brandLabel}
                  </span>
                  <span className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                    AgentHub
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
            <SidebarCollapseButton
              collapseLabel={collapseLabel}
              expandLabel={expandLabel}
            />
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

export function AppSidebarNavItemsSection({
  navItems,
  getSidebarHref,
  navigateFromSidebar,
}: {
  navItems: AppSidebarNavItem[];
  getSidebarHref: (href?: string) => string | undefined;
  navigateFromSidebar: (href?: string, action?: () => void) => void;
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:p-1.5">
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map(({ label, icon: Icon, href, active, action }) => (
            <SidebarMenuItem key={label}>
              <SidebarNavButton
                label={label}
                icon={Icon}
                href={getSidebarHref(href)}
                action={
                  action ? () => navigateFromSidebar(href, action) : undefined
                }
                active={active}
                className="rounded-lg text-[15px] text-sidebar-foreground/82 transition-all hover:bg-white/10 hover:text-white data-[active=true]:bg-white/16 data-[active=true]:text-white data-[active=true]:font-semibold data-[active=true]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] group-data-[collapsible=icon]:justify-center"
                labelClassName="group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebarNavGroups({
  navGroups,
  getSidebarHref,
  navigateFromSidebar,
}: {
  navGroups?: AppSidebarNavGroup[];
  getSidebarHref: (href?: string) => string | undefined;
  navigateFromSidebar: (href?: string, action?: () => void) => void;
}) {
  if (!navGroups) return null;

  return (
    <>
      {navGroups.map((group) => (
        <React.Fragment key={group.label}>
          <Collapsible
            defaultOpen={group.defaultOpen}
            className="group/collapsible group-data-[collapsible=icon]:hidden"
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(
                      ({ label, icon: Icon, href, active, action }) => (
                        <SidebarMenuItem key={label}>
                          <SidebarNavButton
                            label={label}
                            icon={Icon}
                            href={getSidebarHref(href)}
                            action={
                              action
                                ? () => navigateFromSidebar(href, action)
                                : undefined
                            }
                            active={active}
                            className="rounded-lg text-sidebar-foreground/76 transition-all hover:bg-white/10 hover:text-white data-[active=true]:bg-white/12 data-[active=true]:text-white data-[active=true]:font-semibold"
                          />
                        </SidebarMenuItem>
                      ),
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>

          <SidebarGroup className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:p-1.5">
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ label, icon: Icon, href, active, action }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarNavButton
                      label={label}
                      icon={Icon}
                      href={getSidebarHref(href)}
                      action={
                        action
                          ? () => navigateFromSidebar(href, action)
                          : undefined
                      }
                      active={active}
                      className="rounded-lg text-sidebar-foreground/76 transition-all hover:bg-white/10 hover:text-white data-[active=true]:bg-white/16 data-[active=true]:text-white data-[active=true]:font-semibold group-data-[collapsible=icon]:justify-center"
                      labelClassName="group-data-[collapsible=icon]:hidden"
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </React.Fragment>
      ))}
    </>
  );
}
