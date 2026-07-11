"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLayout from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup, { BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import SideNavigation, { SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { Mode, applyMode } from "@cloudscape-design/global-styles";
import { useFlash } from "@/app/providers";
import { api, clearToken, getToken } from "@/lib/api";
import type { User } from "@/lib/types";

interface ShellProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbGroupProps.Item[];
}

/** Side navigation mirroring the real Route 53 console: four flat links,
 * then the Global Resolver / VPC Resolver / Domains / IP-based routing /
 * Traffic flow sections, then the external service links. */
const NAV_ITEMS: SideNavigationProps["items"] = [
  { type: "link", text: "Dashboard", href: "/dashboard" },
  { type: "link", text: "Hosted zones", href: "/hostedzones" },
  { type: "link", text: "Health checks", href: "/healthchecks" },
  { type: "link", text: "Profiles", href: "/profiles" },
  {
    type: "section",
    text: "Global Resolver",
    defaultExpanded: true,
    items: [
      { type: "link", text: "Global resolvers", href: "/resolver", info: <span style={{ color: "#42b4ff", fontSize: 12 }}>New</span> },
      { type: "link", text: "Shared DNS views", href: "/resolver", info: <span style={{ color: "#42b4ff", fontSize: 12 }}>New</span> },
    ],
  },
  {
    type: "section",
    text: "VPC Resolver",
    defaultExpanded: true,
    items: [
      { type: "link", text: "VPCs", href: "/resolver" },
      { type: "link", text: "Inbound endpoints", href: "/resolver" },
      { type: "link", text: "Outbound endpoints", href: "/resolver" },
      { type: "link", text: "Rules", href: "/resolver" },
      { type: "link", text: "Query logging", href: "/resolver" },
      { type: "link", text: "Outposts", href: "/resolver" },
    ],
  },
  {
    type: "section",
    text: "Domains",
    defaultExpanded: true,
    items: [
      { type: "link", text: "Registered domains", href: "/domains" },
      { type: "link", text: "Requests", href: "/domains" },
    ],
  },
  {
    type: "section",
    text: "IP-based routing",
    defaultExpanded: true,
    items: [{ type: "link", text: "CIDR collections", href: "/trafficpolicies" }],
  },
  {
    type: "section",
    text: "Traffic flow",
    defaultExpanded: true,
    items: [
      { type: "link", text: "Traffic policies", href: "/trafficpolicies" },
      { type: "link", text: "Policy records", href: "/trafficpolicies" },
    ],
  },
  { type: "divider" },
  { type: "link", text: "DNS Firewall", href: "/trafficpolicies", external: true },
  { type: "link", text: "Application Recovery Controller", href: "/trafficpolicies", external: true },
];

/** The Route 53 console frame: AWS-style top navigation, side navigation,
 * breadcrumbs and the notifications Flashbar. Also owns the auth guard,
 * dark mode (default, like the screenshots) and keyboard shortcuts. */
export default function Shell({ children, breadcrumbs }: ShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { items } = useFlash();
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
    api<User>("/api/auth/me").then(setUser).catch(() => {});
    // Default to dark mode to match the AWS console.
    const saved = localStorage.getItem("r53_theme");
    const isDark = saved === null ? true : saved === "dark";
    setDark(isDark);
    applyMode(isDark ? Mode.Dark : Mode.Light);
  }, [router]);

  const toggleDark = useCallback(() => {
    setDark(prev => {
      const next = !prev;
      localStorage.setItem("r53_theme", next ? "dark" : "light");
      applyMode(next ? Mode.Dark : Mode.Light);
      return next;
    });
  }, []);

  // Keyboard shortcuts (bonus): z = hosted zones, h = dashboard, m = theme.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "z") router.push("/hostedzones");
      else if (e.key === "h") router.push("/dashboard");
      else if (e.key === "m") toggleDark();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, toggleDark]);

  const signOut = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* sign out locally regardless */
    }
    clearToken();
    router.replace("/login");
  };

  const activeHref = "/" + (pathname?.split("/")[1] ?? "");

  if (!ready) return null;

  return (
    <div>
      <div id="r53-top-nav" style={{ position: "sticky", top: 0, zIndex: 1002 }}>
        <TopNavigation
          identity={{ href: "/dashboard", title: "Route 53" }}
          utilities={[
            { type: "button", iconName: "settings", text: dark ? "Light mode" : "Dark mode", onClick: toggleDark },
            {
              type: "menu-dropdown",
              text: user ? user.name : "Account",
              description: user?.email,
              iconName: "user-profile",
              items: [
                { id: "shortcuts", text: "Shortcuts: z zones · h dashboard · m theme", disabled: true },
                { id: "signout", text: "Sign out" },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === "signout") signOut();
              },
            },
          ]}
        />
      </div>
      <AppLayout
        toolsHide
        headerSelector="#r53-top-nav"
        navigation={
          <SideNavigation
            activeHref={activeHref}
            header={{ href: "/dashboard", text: "Route 53" }}
            items={NAV_ITEMS}
            onFollow={e => {
              if (!e.detail.external) {
                e.preventDefault();
                router.push(e.detail.href);
              }
            }}
          />
        }
        notifications={<Flashbar items={items} stackItems />}
        breadcrumbs={
          breadcrumbs ? (
            <BreadcrumbGroup
              items={breadcrumbs}
              onFollow={e => {
                e.preventDefault();
                router.push(e.detail.href);
              }}
            />
          ) : undefined
        }
        content={children}
      />
    </div>
  );
}
