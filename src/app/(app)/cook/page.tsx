import { PageHeader } from "@/components/PageHeader";
import { CookClient } from "./CookClient";

export const metadata = { title: "Cook · Lifestyle Tracker" };

export default function CookPage() {
  return (
    <>
      <PageHeader title="Cook" />
      <CookClient />
    </>
  );
}
