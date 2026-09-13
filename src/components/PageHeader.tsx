export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-baseline justify-between gap-3">
      <h1 className="font-display text-[26px] font-bold">{title}</h1>
      {children}
    </header>
  );
}
