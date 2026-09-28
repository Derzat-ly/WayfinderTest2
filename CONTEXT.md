# Group Meetings

A web app where an Organiser keeps a set of Members, sorts them into Groups, and sets up Meetings attended by those Members.

## Language

**Organiser**:
A person with an account who owns Members, Groups and Meetings. Each Organiser sees only their own.
_Avoid_: User, admin, owner

**Operator**:
The person who runs the app itself, not an Organiser; for example, they reset an Organiser's forgotten password by hand.
_Avoid_: Admin, superuser

**Member**:
A contact (a person) that an Organiser records, always with a name and an email. A Member never logs in and exists once per Organiser, however many Groups they belong to; no two of an Organiser's Members share an email.
_Avoid_: Contact, person, participant, user

**Group**:
A named collection of an Organiser's Members. A Member can belong to many Groups.
_Avoid_: Team, list, circle

**Meeting**:
A single scheduled gathering an Organiser sets up, happening once at one start time. Its Attendees may come from any of that Organiser's Groups. A Meeting is either one-off or one occurrence of a Meeting Series.
_Avoid_: Event, appointment, session, occurrence (as a separate term)

**Meeting Series**:
A repeat rule an Organiser sets up that produces Meetings at a regular interval (every N days, weeks, months or years) with no end date until the Organiser ends it. Each Meeting it produces starts as a copy of the Series' details.
_Avoid_: Recurring meeting, recurrence, repeating event

**Attendee**:
A Member who is on a particular Meeting, either added individually or through a Linked Group. A Member is at most one Attendee per Meeting, however many ways they were added. Once a Meeting starts, its Attendees are a fixed record of who was on it and their details at that moment, untouched by later edits to or deletion of the Member.
_Avoid_: Invitee, participant, guest

**Linked Group**:
A Group added whole to a Meeting or Meeting Series, whose current Members are Attendees for as long as the link lasts. A Meeting's links freeze at its start time.
_Avoid_: Invited group, group invite, subscribed group
