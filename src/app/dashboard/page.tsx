import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildDashboard, type DashboardData } from "@/lib/scoring";
import { PLAN_LIMITS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RunNowButton } from "./run-now-button";
import { TrendChart, ShareOfVoiceChart } from "./charts";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const brands = await db.listBrandsByUser(user.id);
  if (brands.length === 0) redirect("/onboarding");
  const brand = brands[0];
  const data = await buildDashboard(brand);
  const limits = PLAN_LIMITS[user.plan];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{brand.domain}</p>
          <h1 className="text-2xl font-bold">{brand.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="capitalize">
            {user.plan} plan · {limits.cadence}
          </Badge>
          {user.plan === "free" && process.env.STRIPE_PAYMENT_LINK && (
            <Button
              size="sm"
              nativeButton={false}
              render={
                <a href={`${process.env.STRIPE_PAYMENT_LINK}?client_reference_id=${user.id}&prefilled_email=${encodeURIComponent(user.email)}`}>
                  Upgrade to Pro
                </a>
              }
            />
          )}
          <RunNowButton brandId={brand.id} />
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/settings">Settings</Link>}
          />
          <form
            action={async () => {
              "use server";
              await signOut();
              redirect("/");
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {data.errorRuns > 0 && (
        <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {data.errorRuns} check{data.errorRuns === 1 ? "" : "s"} failed to run — verify your API keys are valid. Failed checks are excluded from the numbers below.
        </div>
      )}

      {data.totalRuns === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">No data yet. Run your first check to see if AI engines mention {brand.name}.</p>
            <RunNowButton brandId={brand.id} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Visibility score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{data.visibilityScore}%</p>
                <p className="text-xs text-muted-foreground">of runs mention {brand.name}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total runs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{data.totalRuns}</p>
                <p className="text-xs text-muted-foreground">across {limits.engines.length} engine(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tracked prompts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{data.promptRows.length}</p>
                <p className="text-xs text-muted-foreground">of {limits.maxPrompts} allowed</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Visibility trend</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart data={data.trend} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Per-engine breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.perEngine.map((e) => (
                  <div key={e.engine} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{e.engine}</span>
                    <span className="text-muted-foreground">
                      {e.visibility}% · {e.runs} runs
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Share of voice</CardTitle>
              </CardHeader>
              <CardContent>
                <ShareOfVoiceChart data={data.shareOfVoice} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile: one card per prompt — a table with a column per engine
                  (up to 3 on Pro) can't fit a 375px viewport. */}
              <div className="space-y-3 md:hidden">
                {data.promptRows.map(({ prompt, byEngine }) => (
                  <div key={prompt.id} className="rounded-md border p-3">
                    <p className="mb-3 text-sm">{prompt.text}</p>
                    <div className="space-y-2">
                      {limits.engines.map((eng) => {
                        const cell = byEngine[eng];
                        return (
                          <div key={eng} className="text-sm">
                            {cell ? (
                              <details className="group">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                                  <span className="capitalize text-muted-foreground">{eng}</span>
                                  <MentionBadge mentions={cell.mentions} />
                                </summary>
                                <MentionDetails cell={cell} hasCompetitors={brand.competitors.length > 0} />
                              </details>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="capitalize text-muted-foreground">{eng}</span>
                                <span className="text-muted-foreground">—</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prompt</TableHead>
                      {limits.engines.map((eng) => (
                        <TableHead key={eng} className="capitalize">
                          {eng}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.promptRows.map(({ prompt, byEngine }) => (
                      <TableRow key={prompt.id}>
                        <TableCell className="max-w-sm">{prompt.text}</TableCell>
                        {limits.engines.map((eng) => {
                          const cell = byEngine[eng];
                          if (!cell) {
                            return (
                              <TableCell key={eng}>
                                <span className="text-muted-foreground">—</span>
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell key={eng}>
                              <details className="group">
                                <summary className="cursor-pointer list-none">
                                  <MentionBadge mentions={cell.mentions} />
                                </summary>
                                <MentionDetails cell={cell} hasCompetitors={brand.competitors.length > 0} />
                              </details>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Most-cited sources</CardTitle>
            </CardHeader>
            <CardContent>
              {data.citedDomains.length === 0 ? (
                <p className="text-sm text-muted-foreground">No citations recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.citedDomains.slice(0, 8).map((d) => (
                    <li key={d.domain} className="flex items-center justify-between">
                      <span>{d.domain}</span>
                      <span className="text-muted-foreground">{d.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        <Link href="/" className="underline">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}

type EngineCell = NonNullable<DashboardData["promptRows"][number]["byEngine"][keyof DashboardData["promptRows"][number]["byEngine"]]>;

function MentionBadge({ mentions }: { mentions: EngineCell["mentions"] }) {
  const own = mentions.find((m) => m.isOwnBrand);
  return own?.mentioned ? (
    <Badge>#{own.rank} · {own.sentiment}</Badge>
  ) : (
    <Badge variant="outline">not mentioned</Badge>
  );
}

function MentionDetails({ cell, hasCompetitors }: { cell: EngineCell; hasCompetitors: boolean }) {
  const competitors = cell.mentions.filter((m) => !m.isOwnBrand && m.mentioned);
  return (
    <div className="mt-2 space-y-2 text-xs">
      {!hasCompetitors ? (
        <p className="text-muted-foreground">No competitors added yet</p>
      ) : competitors.length > 0 ? (
        <ul className="space-y-1">
          {competitors.map((c) => (
            <li key={c.id}>
              {c.entityName} — #{c.rank} · {c.sentiment}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No competitors mentioned in this response</p>
      )}
      <p className="text-muted-foreground">Detected via keyword match — may miss aliases</p>
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded border p-2 text-muted-foreground">
        {cell.run.responseText}
      </div>
    </div>
  );
}
