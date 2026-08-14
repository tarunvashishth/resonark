import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const COMPETITORS = [
  { name: "Profound", price: "$399+/mo" },
  { name: "Peec AI", price: "$100–505/mo" },
  { name: "Otterly", price: "$189+/mo" },
];

const STEPS = [
  {
    n: "01",
    title: "Set up",
    body: "Enter your brand, domain, and competitors. We suggest buyer-intent prompts to track.",
  },
  {
    n: "02",
    title: "Track",
    body: "We ask AI engines those prompts on a schedule and record who gets mentioned.",
  },
  {
    n: "03",
    title: "Improve",
    body: "See your visibility score, share of voice vs competitors, and which sites AI engines cite.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Resonark",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Track whether ChatGPT, Gemini, and Perplexity mention your brand when buyers ask for recommendations — and which competitors they mention instead.",
  offers: [
    { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free — 1 brand, 5 prompts, weekly checks" },
    { "@type": "Offer", price: "29", priceCurrency: "USD", name: "Pro — 3 brands, 25 prompts, 3 engines, daily checks" },
  ],
};

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block size-2.5 rounded-full bg-primary" aria-hidden />
            Resonark
          </Link>
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/login">Sign in</Link>}
            />
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/login">Start tracking</Link>}
            />
          </nav>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-28 text-center">
        <Badge variant="secondary" className="mb-5 gap-1.5 text-primary">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
          AI visibility monitoring
        </Badge>
        <h1 className="text-balance text-5xl font-bold tracking-tighter sm:text-6xl">
          Does ChatGPT recommend your brand?
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Resonark tracks whether ChatGPT, Gemini, and Perplexity mention your brand when buyers ask
          for recommendations — and which competitors they mention instead.
        </p>
        <div className="mt-8 flex gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/login">Start tracking free</Link>} />
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="#how-it-works">How it works</Link>}
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No credit card. Free plan tracks 1 brand, 5 prompts, weekly.
        </p>
      </section>

      <section className="border-t bg-muted/40 py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Everyone else prices for enterprise
          </h2>
          <p className="mt-3 text-center text-muted-foreground">
            AI visibility tools charge agency budgets. Small brands and indie founders are locked out.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {COMPETITORS.map((c) => (
              <Card key={c.name} className="shadow-none">
                <CardContent className="pt-6 text-center">
                  <p className="font-medium text-muted-foreground">{c.name}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground/70 line-through decoration-border">
                    {c.price}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Card className="mx-auto max-w-xs border-primary/40 shadow-lg shadow-primary/10">
              <CardContent className="pt-6 text-center">
                <div className="flex items-center justify-center gap-2">
                  <p className="font-semibold">Resonark</p>
                  <Badge className="text-[10px] uppercase tracking-wide">That’s us</Badge>
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-primary">$29/mo</p>
                <p className="text-sm text-muted-foreground">self-serve</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="font-mono text-sm text-primary">{s.n}</p>
                <p className="mt-2 font-semibold">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Resonark</span>
          <span>Built with Next.js, Supabase, and Claude Code</span>
        </div>
      </footer>
    </main>
  );
}
