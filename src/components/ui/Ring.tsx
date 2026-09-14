/** An SVG progress ring. `fraction` is clamped for drawing; `over` switches to the warning colour. */
export function Ring({
  fraction,
  size = 200,
  stroke = 14,
  color = "var(--pine)",
  over = false,
  label,
  children,
}: {
  fraction: number;
  size?: number;
  stroke?: number;
  color?: string;
  over?: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--tomato)" : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          className="ring-value"
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}
