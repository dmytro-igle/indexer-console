"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-base font-semibold">
          Igle Indexer
        </Link>
        <nav className="flex gap-4 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Dashboard
          </Link>
          <Link href="/runs" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            IndexNow Runs
          </Link>
          <Link href="/runs/google" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Google Runs
          </Link>
        </nav>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        Log out
      </button>
    </header>
  );
}
