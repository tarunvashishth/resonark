"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendEmailCodeAction, verifyEmailCodeAction } from "@/app/actions/auth";

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <form
        className="space-y-4"
        action={(formData) =>
          startTransition(async () => {
            formData.set("email", sentTo);
            try {
              await verifyEmailCodeAction(formData);
            } catch (err) {
              const digest = (err as { digest?: string } | undefined)?.digest;
              if (digest?.startsWith("NEXT_REDIRECT")) throw err;
              toast.error("That code didn't work — check it and try again.");
            }
          })
        }
      >
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to <strong>{sentTo}</strong>.
        </p>
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input id="code" name="code" inputMode="numeric" placeholder="123456" required autoFocus />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Verifying…" : "Verify"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => setSentTo(null)}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      action={(formData) =>
        startTransition(async () => {
          const email = String(formData.get("email"));
          try {
            await sendEmailCodeAction(formData);
            setSentTo(email);
          } catch {
            toast.error("Couldn't send the code — check the email and try again.");
          }
        })
      }
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@company.com" required autoFocus />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Continue"}
      </Button>
    </form>
  );
}
