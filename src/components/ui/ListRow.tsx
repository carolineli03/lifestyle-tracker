import { Icon, type IconName } from "./icons";

/**
 * A 56px row: leading icon or element, title + subtitle that truncate, and a
 * trailing value. When `onClick` is given the whole row is one button.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  icon,
  trailing,
  chevron = false,
  onClick,
  ariaLabel,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  icon?: IconName;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const content = (
    <>
      {(leading || icon) && (
        <span className="list-row-lead" aria-hidden={icon ? true : undefined}>
          {leading ?? (icon && <Icon name={icon} size={18} />)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-snug">{title}</span>
        {subtitle && <span className="t-meta block truncate">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      {chevron && <Icon name="chevron-right" size={18} className="shrink-0 text-muted" />}
    </>
  );
  return onClick ? (
    <button type="button" className="list-row" onClick={onClick} aria-label={ariaLabel}>
      {content}
    </button>
  ) : (
    <div className="list-row">{content}</div>
  );
}

export function EmptyState({
  icon,
  text,
  action,
}: {
  icon: IconName;
  text: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 px-4 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--pine-wash)", color: "var(--pine)" }}>
        <Icon name={icon} size={22} />
      </span>
      <p className="max-w-[28ch] text-[15px] text-muted">{text}</p>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 px-1">
      <h2 className="t-label">{children}</h2>
      {action}
    </div>
  );
}
