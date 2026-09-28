# Lazy catch-up instead of a scheduler for start-time work

When a Meeting starts, its Attendees are snapshotted and its Linked Groups freeze; each Meeting Series keeps a rolling window of future Meetings. The MVP runs locally and may be off when a Meeting starts, so instead of a scheduled job, every request that reads or writes Meetings, Members or Groups first runs a catch-up step that finalises any Meeting whose start has passed and tops up Series windows. Because every change goes through the app, nothing can change between a Meeting's start and the next catch-up, so the snapshot matches what an on-time job would have captured.

## Considered Options

- **In-process scheduler (e.g. every minute)**: rejected; it still needs the catch-up path for downtime, so it is strictly more code.

## Consequences

- Any new way of changing data outside a request (import scripts, the Operator's admin script) must run the catch-up step first, or it can corrupt snapshots.
