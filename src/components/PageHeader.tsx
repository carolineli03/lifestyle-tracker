import Link from "next/link";
import { Icon } from "@/components/ui/icons";

/** Page title on the left; the page's own actions, then the Settings gear, on the right. */
export function PageHeader({
  title,
  children,
  settings = true,
}: {
  title: string;
  children?: React.ReactNode;
  settings?: boolean;
}) {
  return (
    <header className="mb-4 flex items-center justify-between gap-2">
      <h1 className="t-title">{title}</h1>
      <div className="flex items-center gap-1">
        {children}
        {settings && <SettingsLink />}
      </div>
    </header>
  );
}

export function SettingsLink() {
  return (
    <Link href="/settings" className="icon-btn" aria-label="Settings">
      <Icon name="gear" size={22} />
    </Link>
  );
}
