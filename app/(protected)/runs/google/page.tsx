import Link from "next/link";
import { listGoogleBatches } from "@/lib/db/googleSubmissions";
import { getRocketIndexerBalance } from "@/lib/google/rocketIndexer";
import RocketIndexerBalanceCard from "@/components/RocketIndexerBalanceCard";

// Reads live DB state (and a live RocketIndexer API call) on every request
// — must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function GoogleRunsPage() {
  const batches = listGoogleBatches();
  const balance = await getRocketIndexerBalance();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Google run history</h1>
      <RocketIndexerBalanceCard balance={balance} />
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Finished</th>
              <th className="px-3 py-2">Domains</th>
              <th className="px-3 py-2">URLs</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-2">
                  <Link href={`/runs/google/${b.id}`} className="hover:underline">
                    {b.started_at}
                  </Link>
                </td>
                <td className="px-3 py-2 text-neutral-500">{b.finished_at ?? "—"}</td>
                <td className="px-3 py-2 text-neutral-500">{b.domain_count}</td>
                <td className="px-3 py-2 text-neutral-500">{b.url_count}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-400">
                  No Google submit runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
