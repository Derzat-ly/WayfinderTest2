import Link from "next/link";

export function DuplicateEmail({ id, name }: { id: string; name: string }) {
  return (
    <p className="error" role="alert">
      <Link href={`/members/${id}`}>{name}</Link> already has this email.
    </p>
  );
}
