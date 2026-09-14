/**
 * The app's icon set: inline SVG paths on a 24px grid, stroked with
 * currentColor. No icon package, no extra request.
 */

export type IconName =
  | "plus"
  | "gear"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "close"
  | "more"
  | "water"
  | "walk"
  | "scale"
  | "camera"
  | "barcode"
  | "search"
  | "sparkle"
  | "bolt"
  | "trash"
  | "check"
  | "fridge"
  | "snowflake"
  | "pantry"
  | "cart"
  | "calendar"
  | "copy"
  | "flame"
  | "ruler"
  | "image"
  | "book"
  | "chart"
  | "leaf";

const PATHS: Record<IconName, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </>
  ),
  water: <path d="M12 2.7s-6.5 7.1-6.5 11.8a6.5 6.5 0 0 0 13 0C18.5 9.8 12 2.7 12 2.7Z" />,
  walk: (
    <>
      <circle cx="13" cy="4" r="2" />
      <path d="m7 21 3-7 3 3v5M10 14l1-5 4 3 3 1M11 9 8 10l-2 4" />
    </>
  ),
  scale: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 9a5 5 0 0 1 8 0l-3 3" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  barcode: <path d="M4 5v14M7 5v14M10.5 5v14M14 5v14M16.5 5v14M20 5v14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  fridge: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="3" />
      <path d="M5 10h14M8.5 6.5v1.5M8.5 13v2.5" />
    </>
  ),
  snowflake: <path d="M12 2v20M4.9 6.5l14.2 11M19.1 6.5 4.9 17.5M9 4l3 2 3-2M9 20l3-2 3 2" />,
  pantry: (
    <>
      <path d="M4 20V8l8-5 8 5v12" />
      <path d="M4 13h16M9 20v-4h6v4" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
      <path d="M2.5 3h2.8l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.5a1.5 1.5 0 0 0 1.5-1.1L21 7H6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
    </>
  ),
  flame: <path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.5-6.5-4-8-.3 2-1.3 3.3-2.5 4 0-3.5-1.5-6.5-4-9-.5 4.5-4.5 7.5-4.5 13 0 4.2 3.5 7 8 7Z" />,
  ruler: <path d="m3 16 13-13 5 5L8 21Zm4-1 2 2m1-5 2 2m1-5 2 2" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L6 21" />
    </>
  ),
  book: <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 21.5h14" />,
  chart: <path d="M3.5 16.5 9 11l3.5 3.5L20.5 6M20.5 10.5V6h-4.5" />,
  leaf: <path d="M5 21c.5-4 3-8 9-10M20 3c0 9-4.5 15-11 15-2 0-4-1-4-4 0-6.5 6-11 15-11Z" />,
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
  label,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Give a label only when the icon carries meaning on its own. */
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
