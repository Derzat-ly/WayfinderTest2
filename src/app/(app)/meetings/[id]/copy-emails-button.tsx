"use client";

import { useState } from "react";

/** Puts every Attendee's email on the clipboard. The app itself sends no email. */
export function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [status, setStatus] = useState<"copied" | "failed" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <p className="copy-emails">
      <button type="button" className="button" onClick={copy}>
        Copy Attendee emails
      </button>{" "}
      <span role="status">
        {status === "copied" && (
          <span className="success">
            Copied {emails.length} {emails.length === 1 ? "email" : "emails"}.
          </span>
        )}
        {status === "failed" && (
          <span className="error">Couldn’t reach the clipboard.</span>
        )}
      </span>
    </p>
  );
}
