import { PageHeader } from "@/components/PageHeader";
import { Placeholder } from "@/components/Placeholder";

export const metadata = { title: "Cook · Icebox" };

export default function CookPage() {
  return (
    <>
      <PageHeader title="Cook" />
      <Placeholder what="Three ideas from what's on hand, and a Sunday prep plan." phase="phase 5" />
    </>
  );
}
