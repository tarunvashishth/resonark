import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const COMPETITORS = [
  { name: "Profound", price: "$399+/mo" },
  { name: "Peec AI", price: "$100–505/mo" },
  { name: "Otterly", price: "$189+/mo" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="mb-4 text-sm font-medium text-muted-foreground">AI visibility monitoring</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Does ChatGPT recommend your brand?
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          EchoRank tracks whether ChatGPT, Gemini, and Perplexity mention your brand when buyers ask
          for recommendations — and which competitors they mention instead.
        </p>
        <div className="mt-8 flex gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/login">Start tracking free</Link>} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">No credit card. Free plan tracks 1 brand, 5 prompts, weekly.</p>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-semibold">Everyone else prices for enterprise</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            AI visibility tools charge agency budgets. Small brands and indie founders are locked out.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {COMPETITORS.map((c) => (
              <Card key={c.name}>
                <CardContent className="pt-6 text-center">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.price}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Card className="mx-auto max-w-xs border-primary">
              <CardContent className="pt-6 text-center">
                <p className="font-medium">EchoRank</p>
                <p className="text-sm text-muted-foreground">$19–29/mo · self-serve</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-primary">1. Set up</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your brand, domain, and competitors. We suggest buyer-intent prompts to track.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">2. Track</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We ask AI engines those prompts on a schedule and record who gets mentioned.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">3. Improve</p>
              <p className="mt-1 text-sm text-muted-foreground">
                See your visibility score, share of voice vs competitors, and which sites AI engines cite.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        EchoRank — built with Next.js, Supabase, and Claude Code.
      </footer>
    </main>
  );
}
