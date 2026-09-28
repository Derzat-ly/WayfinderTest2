"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

const sections = [
  { href: "/meetings", label: "Meetings" },
  { href: "/members", label: "Members" },
  { href: "/groups", label: "Groups" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ name, timezone }: { name: string; timezone: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <nav>
        {sections.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <strong>{name}</strong>
        <span className="hint">{timezone}</span>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
