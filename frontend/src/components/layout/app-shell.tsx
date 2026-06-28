"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";
import { signOut } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "New Upload", icon: Upload },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  profile,
  usageThisMonth,
}: {
  children: React.ReactNode;
  profile: UserProfile & { id?: string };
  usageThisMonth: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Captionovo</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-3 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/50">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Credits
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {profile.creditsRemaining} min
            </p>
            <p className="text-xs text-zinc-500">{usageThisMonth} used this month</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {profile.name}
              </p>
              <p className="text-xs text-zinc-500">{profile.planName} plan</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900 lg:px-8">
          <div className="lg:hidden">
            <span className="text-lg font-semibold">Captionovo</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 sm:inline">
              {profile.creditsRemaining} minutes remaining
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
