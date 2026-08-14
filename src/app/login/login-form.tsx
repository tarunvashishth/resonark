"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendEmailCodeAction, verifyEmailCodeAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

function GoogleButton() {
  return (
    <>
      {/* A plain anchor to a route handler, not a Server Action — the browser
          must follow the cross-origin redirect to Google itself. */}
      <a href="/auth/google" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
        <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.8Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.93-2.92l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A11.98 11.98 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.29 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.29a11.98 11.98 0 0 0 0 10.74l4-3.1Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.53 11.53 0 0 0 12 0 11.98 11.98 0 0 0 1.29 6.63l4 3.1C6.23 6.89 8.88 4.77 12 4.77Z"
          />
        </svg>
        Continue with Google
      </a>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

export function LoginForm({ googleAuth = false }: { googleAuth?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const oauthError = useSearchParams().get("error");

  useEffect(() => {
    if (oauthError === "oauth") toast.error("Google sign-in failed — please try again.");
  }, [oauthError]);

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
      {googleAuth && <GoogleButton />}
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
