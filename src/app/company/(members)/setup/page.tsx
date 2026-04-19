import { redirect } from "next/navigation";

type SearchParams = Promise<{ registered?: string; saved?: string }>;

/**
 * Legacy route. The old dashboard/profile combo lived here.
 * Kept as a permanent redirect so existing links (e.g. the post-signup flow
 * and external bookmarks) land on the new workspace.
 */
export default async function CompanySetupRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { registered, saved } = await searchParams;
  if (registered === "1") redirect("/company/dashboard?welcome=1");
  if (saved === "1") redirect("/company/profile?saved=1");
  redirect("/company/dashboard");
}
