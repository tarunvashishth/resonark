"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runNowAction } from "@/app/actions/brand";

export function RunNowButton({ brandId }: { brandId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const count = await runNowAction(brandId);
            toast.success(`Ran ${count} quer${count === 1 ? "y" : "ies"} across AI engines.`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't run checks — try again.");
          }
        })
      }
    >
      {isPending ? "Running…" : "Run now"}
    </Button>
  );
}
