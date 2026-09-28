# Meetings store a copy of the Organiser's timezone

Organisers pick no timezone per Meeting: every Meeting uses the timezone set once in Settings. Even so, each Meeting and Meeting Series row stores its start as a UTC instant plus the IANA timezone copied from the Organiser when the row was created. The copy is never shown as a per-Meeting choice. It means a later timezone change in Settings doesn't move or re-label existing Meetings. A Series also keeps producing occurrences at the same local time across DST, because it works out each occurrence in its own stored zone.

## Considered Options

- **UTC only, reading the Organiser's current timezone**: rejected. Changing the Settings timezone would silently change how past Meetings read and shift the times of Series occurrences not yet produced.
- **Local wall time only**: rejected. Every "has this Meeting started?" check in the lazy catch-up (ADR 0001) would have to convert through a timezone.

## Consequences

- A new Meeting or Series takes the Organiser's timezone at the moment it is created. Existing rows keep theirs.
