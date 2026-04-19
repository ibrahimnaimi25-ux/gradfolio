import { requireCompany } from "@/lib/auth";
import CompanySubNav from "@/components/company/CompanySubNav";

export default async function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every /company/* route once at the layout level.
  // Child pages that need the profile still call requireCompany() themselves.
  await requireCompany();

  return (
    <>
      <CompanySubNav />
      {children}
    </>
  );
}
