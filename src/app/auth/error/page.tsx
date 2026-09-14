import Link from "next/link";

export const metadata = { title: "Sign-in problem · Lifestyle Tracker" };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-10">
      <h1 className="font-display text-2xl font-bold">That link didn&rsquo;t work</h1>
      <p className="mt-2 text-[15px] text-muted">
        {reason === "missing-code"
          ? "The link was missing its sign-in token. That usually means it was opened twice, or an email client rewrote it."
          : "Sign-in links expire after an hour and can only be used once."}
      </p>
      {reason && reason !== "missing-code" && (
        <p className="mt-2 text-[13px] text-muted">Supabase said: {reason}</p>
      )}
      <Link href="/login" className="btn btn-primary mt-6 self-start">
        Send a new link
      </Link>
    </main>
  );
}
