"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";

type Tab = { href: "/today" | "/fridge" | "/cook" | "/progress"; label: string; icon: IconName };

const LEFT: readonly Tab[] = [
  { href: "/today", label: "Today", icon: "calendar" },
  { href: "/fridge", label: "Fridge", icon: "fridge" },
];
const RIGHT: readonly Tab[] = [
  { href: "/cook", label: "Cook", icon: "leaf" },
  { href: "/progress", label: "Progress", icon: "chart" },
];

/**
 * Four tabs around a raised + that logs food from anywhere. The + always goes
 * to /today?log=1, which opens the log sheet, so there's one path whichever
 * tab you're on.
 */
export function BottomNav() {
  const pathname = usePathname();

  const item = (tab: Tab) => {
    const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    return (
      <li key={tab.href} className="flex-1">
        <Link
          href={tab.href}
          aria-current={active ? "page" : undefined}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
          style={{ minHeight: 56, color: active ? "var(--pine)" : "var(--muted)" }}
        >
          <Icon name={tab.icon} size={22} strokeWidth={active ? 2.1 : 1.7} />
          {tab.label}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-[640px] items-center">
        {LEFT.map(item)}
        <li className="flex flex-1 justify-center">
          <Link href="/today?log=1" className="fab" aria-label="Log food">
            <Icon name="plus" size={28} strokeWidth={2.4} />
          </Link>
        </li>
        {RIGHT.map(item)}
      </ul>
    </nav>
  );
}
