"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: "/today" | "/fridge" | "/cook" | "/progress";
  label: string;
  /** Inline SVG path data — no icon package, no extra request. */
  icon: React.ReactNode;
};

const TABS: readonly Tab[] = [
  {
    href: "/today",
    label: "Today",
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="3" />
        <path d="M8 2.5v4M16 2.5v4M3 10h18" />
      </>
    ),
  },
  {
    href: "/fridge",
    label: "Fridge",
    icon: (
      <>
        <rect x="5" y="2.5" width="14" height="19" rx="3" />
        <path d="M5 10h14M8.5 6.5v1.5M8.5 13v2.5" />
      </>
    ),
  },
  {
    href: "/cook",
    label: "Cook",
    icon: (
      <>
        <path d="M4 13.5h16" />
        <path d="M5.5 13.5a6.5 6.5 0 0 1 13 0" />
        <path d="M4.5 17.5h15a1 1 0 0 1 0 3.5h-15a1 1 0 0 1 0-3.5Z" />
        <path d="M12 7V4.5" />
      </>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: (
      <>
        <path d="M3.5 16.5 9 11l3.5 3.5L20.5 6" />
        <path d="M20.5 10.5V6h-4.5" />
      </>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-[640px]">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold"
                style={{ minHeight: 56, color: active ? "var(--pine)" : "var(--muted)" }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.1 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
