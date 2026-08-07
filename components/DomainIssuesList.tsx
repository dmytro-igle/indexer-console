import type { BriefIssueRow } from "@/lib/seo/issues";

export default function DomainIssuesList({ issues }: { issues: BriefIssueRow[] }) {
  if (issues.length === 0) {
    return (
      <p className="text-sm text-green-700 dark:text-green-400">
        No outstanding issues detected in the most recent checks.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {issues.map((issue, i) => (
        <li
          key={i}
          className="rounded-md border border-yellow-200 bg-yellow-50/50 p-3 dark:border-yellow-900/40 dark:bg-yellow-950/20"
        >
          <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">{issue.reference}</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{issue.description}</p>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-neutral-600 dark:text-neutral-300">Suggested fix:</span>{" "}
            {issue.action}
          </p>
        </li>
      ))}
    </ul>
  );
}
