import type { RocketIndexerBalance } from "@/lib/google/rocketIndexer";

export default function RocketIndexerBalanceCard({ balance }: { balance: RocketIndexerBalance }) {
  if (!balance.configured) {
    return (
      <div className="rounded-lg border border-black/10 p-4 text-sm text-neutral-500 dark:border-white/10">
        RocketIndexer API key not configured — add <code>ROCKETINDEXER_API_KEY</code> to see your
        credit balance here.
      </div>
    );
  }

  if (!balance.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
        Couldn&apos;t fetch RocketIndexer balance: {balance.errorMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-sm font-semibold text-neutral-500">RocketIndexer balance</h2>
      <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <p className="text-2xl font-semibold text-green-700 dark:text-green-400">
            {balance.available ?? "—"}
          </p>
          <p className="text-xs text-neutral-500">Credits available</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{balance.used ?? "—"}</p>
          <p className="text-xs text-neutral-500">Credits used</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{balance.totalSubmitted ?? "—"}</p>
          <p className="text-xs text-neutral-500">Total submitted</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{balance.delivered ?? "—"}</p>
          <p className="text-xs text-neutral-500">Delivered</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{balance.inProgress ?? "—"}</p>
          <p className="text-xs text-neutral-500">In progress</p>
        </div>
      </div>
    </div>
  );
}
