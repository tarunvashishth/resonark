"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSuggestions, createBrandWithPrompts } from "@/app/actions/onboarding";
import type { SuggestedPrompt } from "@/lib/suggest";

type PromptDraft = SuggestedPrompt & { selected: boolean };

export function OnboardingWizard({ maxPrompts }: { maxPrompts: number }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("");
  const [competitors, setCompetitors] = useState(["", "", ""]);
  const [prompts, setPrompts] = useState<PromptDraft[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCount = prompts.filter((p) => p.selected).length;

  function goToPrompts() {
    if (!name.trim() || !domain.trim() || !category.trim()) {
      toast.error("Fill in brand name, domain, and category first.");
      return;
    }
    startTransition(async () => {
      const suggestions = await fetchSuggestions(category);
      setPrompts(suggestions.map((s) => ({ ...s, selected: true })));
      setStep(2);
    });
  }

  function toggle(index: number) {
    setPrompts((prev) => prev.map((p, i) => (i === index ? { ...p, selected: !p.selected } : p)));
  }

  function addCustomPrompt() {
    if (!customPrompt.trim()) return;
    setPrompts((prev) => [...prev, { text: customPrompt.trim(), intentCategory: "custom", selected: true }]);
    setCustomPrompt("");
  }

  function submit() {
    const selected = prompts.filter((p) => p.selected);
    if (selected.length === 0) {
      toast.error("Select at least one prompt to track.");
      return;
    }
    startTransition(async () => {
      try {
        await createBrandWithPrompts({
          name,
          domain,
          category,
          competitors: competitors.map((c) => c.trim()).filter(Boolean),
          prompts: selected.map(({ text, intentCategory }) => ({ text, intentCategory })),
        });
      } catch (err) {
        // redirect() throws a NEXT_REDIRECT control-flow error on success — let it propagate.
        if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (step === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your brand</CardTitle>
          <CardDescription>We&apos;ll track whether AI answer engines mention you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Brand name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">What do you sell? (used to generate prompts)</Label>
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
                onChange={(e) =>
                  setCompetitors((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                placeholder={`Competitor ${i + 1}`}
                aria-label={`Competitor ${i + 1}`}
                className="mb-2"
              />
            ))}
          </div>
          <Button onClick={goToPrompts} disabled={isPending} className="w-full">
            {isPending ? "Generating prompts…" : "Suggest prompts to track"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose prompts to track</CardTitle>
        <CardDescription>
          {selectedCount} selected · your plan allows up to {maxPrompts}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {prompts.map((p, i) => (
            <label key={i} className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox checked={p.selected} onCheckedChange={() => toggle(i)} className="mt-0.5" />
              <span>{p.text}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Add your own prompt…"
            aria-label="Add your own prompt"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomPrompt())}
          />
          <Button type="button" variant="outline" onClick={addCustomPrompt}>
            Add
          </Button>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button onClick={submit} disabled={isPending} className="flex-1">
            {isPending ? "Saving…" : "Start tracking"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
