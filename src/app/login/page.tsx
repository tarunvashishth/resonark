import Link from "next/link";
import { devSignIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Link href="/" className="text-sm font-semibold text-muted-foreground">
            EchoRank
          </Link>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            No password needed. In production this sends a magic link — in this dev build it signs you in immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={devSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required autoFocus />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
