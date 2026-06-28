import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { fetchProfile, fetchTransactions } from "@/lib/api/server";
import { formatDate, formatDuration } from "@/lib/utils";

export default async function BillingPage() {
  const [{ profile, usageThisMonth }, transactions] = await Promise.all([
    fetchProfile(),
    fetchTransactions(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Billing & Credits
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Understand exactly how your minutes are used
          </p>
        </div>
        <Button>Buy more credits</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-zinc-500">Current plan</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {profile.planName}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-zinc-500">Minutes remaining</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
              {profile.creditsRemaining}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-zinc-500">Used this month</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {usageThisMonth} min
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Usage history</h2>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 pt-0">
          {transactions.length === 0 ? (
            <p className="px-5 py-8 text-sm text-zinc-500">No usage yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Credits</th>
                  <th className="px-5 py-3 font-medium">Outputs</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-zinc-50 dark:border-zinc-800/50"
                  >
                    <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {tx.projectTitle}
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDuration(tx.durationMinutes)}
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                      {tx.creditsUsed} min
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                      {tx.outputTypes.join(", ")}
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDate(tx.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
