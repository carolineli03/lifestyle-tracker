import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { getSession } from "@/lib/household";

/**
 * Shell for the four tabs. Two gates, in order: signed in, then in a
 * household. The middleware handles the first one too, but a server-side
 * check here means a page never renders against a missing session.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.household) redirect("/onboarding");

  return (
    <div className="min-h-dvh">
      {/* Desktop is just the mobile column, centred. */}
      <div className="mx-auto w-full max-w-[640px] px-5 pt-4" style={{ paddingBottom: 88 }}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
