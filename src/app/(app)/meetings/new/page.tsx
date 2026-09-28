import Link from "next/link";
import { requireOrganiserData } from "@/app-context";
import { NewMeetingForm } from "./new-meeting-form";

export default async function NewMeetingPage() {
  const data = await requireOrganiserData();
  const { timezone } = await data.organiser();
  const members = (await data.members()).map(({ id, name, email }) => ({
    id,
    name,
    email,
  }));

  return (
    <>
      <p className="hint">
        <Link href="/meetings">Meetings</Link>
      </p>
      <h1>New meeting</h1>
      <NewMeetingForm members={members} timezone={timezone} />
    </>
  );
}
