"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/client";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "Could not sign in");
    router.push("/meetings");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Sign in</h1>
        <form className="form" action={signIn}>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button" disabled={pending}>
            Sign in
          </button>
        </form>
        <p className="hint">
          Forgotten your password? Contact the person who runs this app (the
          Operator) and they will set you a temporary one.
        </p>
        <p className="hint">
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
