import { requireOrganiserData } from "@/app-context";
import { Sidebar } from "./sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organiser = await (await requireOrganiserData()).organiser();

  return (
    <div className="shell">
      <Sidebar name={organiser.name} timezone={organiser.timezone} />
      <main className="main">{children}</main>
    </div>
  );
}
