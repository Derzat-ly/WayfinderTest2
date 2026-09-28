import { requireOrganiserData } from "@/app-context";
import { PasswordForm } from "./password-form";
import { TimezoneForm } from "./timezone-form";

export default async function SettingsPage() {
  const { timezone } = await (await requireOrganiserData()).organiser();
  const zones = [
    ...new Set([...Intl.supportedValuesOf("timeZone"), "UTC", timezone]),
  ].sort();

  return (
    <>
      <h1>Settings</h1>
      <section className="settings-section">
        <h2>Timezone</h2>
        <TimezoneForm current={timezone} zones={zones} />
      </section>
      <section className="settings-section">
        <h2>Password</h2>
        <PasswordForm />
      </section>
    </>
  );
}
