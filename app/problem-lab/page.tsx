import { redirect } from "next/navigation";
import ProblemLabClient from "./problem-lab-client";

export default async function ProblemLabPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const sp = await searchParams;
  const embed = sp?.embed === "1";
  if (!embed) {
    redirect("/trainer?mode=problem-lab");
  }
  return <ProblemLabClient />;
}
