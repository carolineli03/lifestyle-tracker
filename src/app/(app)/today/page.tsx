import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";
import { getSession } from "@/lib/household";

export const metadata = { title: "Today · Icebox" };

export default async function TodayPage() {
  const session = await getSession();

  return (
    <>
      <PageHeader title="Today">
        <span className="text-[13px] text-muted">{session?.email}</span>
      </PageHeader>
      <Placeholder
        what="Calories remaining, food log, movement and weigh-in."
        phase="phase 2"
      />
    </>
  );
}
