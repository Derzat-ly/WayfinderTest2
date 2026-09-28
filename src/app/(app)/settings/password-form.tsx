"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function changePassword(form: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword")),
      newPassword: String(form.get("newPassword")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "Could not change password");
    setSaved(true);
  }

  return (
    <form className="form" action={changePassword}>
      <label className="field">
        Current password
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label className="field">
        New password
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {saved && <p className="success">Password changed.</p>}
      <button className="button" disabled={pending}>
        Change password
      </button>
    </form>
  );
}
