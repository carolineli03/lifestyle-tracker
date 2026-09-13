/**
 * Visible failure. Every write path on the Today tab routes here rather than
 * failing quietly — and the manual path stays usable underneath.
 */
export function ErrorNote({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-3 rounded-field p-3"
      style={{ background: "var(--tomato-wash)", border: "1px solid var(--tomato)" }}
    >
      <p className="flex-1 text-[14px]" style={{ color: "var(--tomato)" }}>
        {message}
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-[14px] font-semibold"
          style={{ color: "var(--tomato)", minHeight: 0 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
