import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Progress · Icebox" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progress" />
      <Placeholder what="Weight chart, movement bars and the target calculator." phase="phase 4" />
    </>
  );
}
