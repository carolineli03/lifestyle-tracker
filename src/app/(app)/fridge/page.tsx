import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { getSession } from "@/lib/household";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "Fridge · Icebox" };

export default async function FridgePage() {
  const session = await getSession();
  const household = session?.household;

  return (
    <>
      <PageHeader title="Fridge" />

      {household && (
        <section className="card mb-4 p-5">
          <h2 className="font-display text-lg font-semibold">{household.name}</h2>
          <p className="mt-1 text-[13px] text-muted">
            Share this code so the other person&rsquo;s app sees the same fridge.
          </p>
          <p className="mt-3 font-display text-3xl font-bold tracking-[0.3em]">
            {household.join_code}
          </p>
        </section>
      )}

      <Placeholder what="Inventory by location, expiry badges and bulk add." phase="phase 3" />

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[13px] text-muted">Theme</span>
        <ThemeToggle />
      </div>

      <form action="/auth/signout" method="post" className="mt-4">
        <button type="submit" className="btn btn-quiet w-full">
          Sign out
        </button>
      </form>
    </>
  );
}
