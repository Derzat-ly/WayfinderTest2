"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/client";
import { detectTimezone } from "@/timezone";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signUp(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      timezone: detectTimezone(),
    });
    setPending(false);
    if (error) return setError(error.message ?? "Could not create account");
    router.push("/meetings");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Create an account</h1>
        <form className="form" action={signUp}>
          <label className="field">
            Name
            <input name="name" autoComplete="name" required />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button" disabled={pending}>
            Create account
          </button>
        </form>
        <p className="hint">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
