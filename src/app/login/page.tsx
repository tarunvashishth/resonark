import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Link href="/" className="text-sm font-semibold text-muted-foreground">
            EchoRank
          </Link>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>No password needed. We&apos;ll email you a sign-in code.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
