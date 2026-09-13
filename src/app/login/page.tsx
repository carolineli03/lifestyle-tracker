import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Icebox" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-10">
      <h1 className="font-display text-4xl font-bold">Icebox</h1>
      <p className="mt-2 max-w-[42ch] text-[15px] text-muted">
        What&rsquo;s in the kitchen, what you ate, and what to cook next.
      </p>

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
