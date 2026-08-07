import { listDomains } from "@/lib/db/domains";
import Dashboard from "@/components/Dashboard";

// This page reads live DB state on every request (domain list, latest
// check/submit status) — it must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const domains = listDomains();
  return <Dashboard initialDomains={domains} />;
}
