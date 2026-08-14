"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBrandAction } from "@/app/actions/brand";

interface BrandFields {
  name: string;
  domain: string;
  category: string;
  competitors: string[];
}

export function BrandSettingsForm({ brandId, initial }: { brandId: string; initial: BrandFields }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [domain, setDomain] = useState(initial.domain);
  const [category, setCategory] = useState(initial.category);
  const [competitors, setCompetitors] = useState<string[]>(
    Array.from({ length: 3 }, (_, i) => initial.competitors[i] ?? "")
  );
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || !domain.trim() || !category.trim()) {
      toast.error("Brand name, domain, and category are required.");
      return;
    }
    startTransition(async () => {
      try {
        await updateBrandAction(brandId, {
          name: name.trim(),
          domain: domain.trim(),
          category: category.trim(),
          competitors: competitors.map((c) => c.trim()).filter(Boolean),
        });
        toast.success("Brand settings saved.");
        router.push("/dashboard");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Brand name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="domain">Domain</Label>
        <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">What do you sell?</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="project management software"
        />
      </div>
      <div className="space-y-2">
        <Label>Competitors (up to 3)</Label>
        {competitors.map((c, i) => (
          <Input
            key={i}
            value={c}
            onChange={(e) => setCompetitors((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
            placeholder={`Competitor ${i + 1}`}
            aria-label={`Competitor ${i + 1}`}
            className="mb-2"
          />
        ))}
        <p className="text-xs text-muted-foreground">
          Competitors power the share-of-voice chart and per-prompt competitor detection.
        </p>
      </div>
      <Button onClick={submit} disabled={isPending} className="w-full">
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
