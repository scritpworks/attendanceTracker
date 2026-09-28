# MyApp_ATTR: Attendance Tracking and Registration System

## How to use this document

This document explains what MyApp_ATTR is, who uses it, and exactly how it behaves from start to finish. It is written in plain English so that whoever builds it (a person or an AI model) understands the flow and the rules before writing any code.

Two things are already decided:

- MyApp_ATTR is a **web application**, and the screens are built with **React and Vite**.
- A **login and role-based access system already exists**. In it, an administrator with the right permission can create roles and assign permissions to them. This system must be **reused, not rebuilt**. MyApp_ATTR only adds new permissions and a new "Member" role to it.

Everything else (database, server technology, libraries) is left to the builder, as long as the behaviour below is followed exactly.

---

## 1. What the system is for

MyApp_ATTR replaces paper or manual attendance records for an organisation that holds meetings. It lets administrators:

- register members,
- schedule meetings,
- mark who attended each meeting,
- produce attendance reports.

It also lets each member log in and see their own attendance record, in read-only form.

**Main goals**

- Move attendance registration from paper to a digital system.
- Keep attendance records accurate, secure and permanent.
- Let members see their own history without being able to change it.
- Give administrators reports they can view, print and export.

---

## 2. Who uses the system

### 2.1 Administrators

There can be **several administrators**. What each one can do is not fixed. It depends on the **role** they have been given, and each role is a set of permissions. One administrator might only be allowed to take attendance, while another can register members and generate reports.

Every screen and every action in the system must respect these permissions. If someone lacks the permission, the button must be hidden **and** the action must be refused if they try it anyway.

### 2.2 Members

A member is an ordinary person on the register. Members log in with their **Member ID and a password**. They can only **view their own** attendance. They cannot add, edit or delete anything.

Members use the same login system as administrators, but they are given a built-in role called **Member**, which holds one permission: viewing their own attendance.

---

## 3. Permissions

These are the permissions MyApp_ATTR adds to the existing role system. An administrator with the right to manage roles can bundle any of them into a role.

| Permission | What it allows |
|---|---|
| members.view | See the list of members and member details |
| members.create | Register a new member |
| members.edit | Change a member's details |
| members.deactivate | Deactivate or reactivate a member |
| meetings.view | See scheduled meetings |
| meetings.create | Create a new meeting |
| meetings.edit | Change or cancel a meeting |
| attendance.mark | Mark attendance for a meeting (Present/Absent) |
| attendance.edit | Correct attendance that was already marked |
| attendance.view_all | See attendance for any member or meeting |
| attendance.view_own | See only your own attendance (this is what members have) |
| reports.generate | Create attendance reports |
| reports.export | Export reports to PDF and Excel |
| audit.view | See the log of changes made to attendance |
| dashboard.view | See the administrator dashboard |

Splitting **mark** from **edit** matters. It allows someone to take attendance at a meeting without being able to change records that were saved earlier.

**Important rule for members:** when a member asks for attendance records, the system must work out who they are from their login session, never from anything they send in the request. This makes it impossible for a member to view someone else's records by changing an ID.

---

## 4. The main things the system keeps track of

**Member.** A person on the register.
- Member ID (unique, no two members can share one)
- Full name
- Phone number
- Email address (optional)
- Other membership information as needed
- Active or inactive status
- Login account (linked to the existing login system)

**Meeting.** A scheduled gathering.
- Title or description
- Date
- Time
- Status: **Scheduled** or **Cancelled**
- Who created it

**Attendance record.** One row for one member at one meeting.
- Which member
- Which meeting
- Status: **Present** or **Absent** (there is no Late or Excused status)
- The time attendance was recorded (empty until the member is marked Present)
- Who marked it

There can only ever be **one attendance record per member per meeting**.

**Attendance change log.** A history of every correction made to an attendance record.
- Which record was changed
- Who changed it
- When
- The old status and the new status

---

## 5. How the system works, step by step

### 5.1 Logging in

**Administrator login**
1. The administrator opens the login page and enters a username and password.
2. If the details are wrong, a clear error message is shown and nothing else happens.
3. If correct, they enter the system and see only the screens and actions their role allows.

**Member login**
1. The member opens the login page and enters their **Member ID** and **password**.
2. If wrong, a clear error message is shown.
3. If correct, they go straight to their personal attendance page. That is the only area they can reach.

Passwords must always be stored securely, never as readable text. When a member's account is first created, they should be required to change their password on first login.

### 5.2 Registering a new member

1. An administrator with `members.create` opens the New Member screen.
2. They enter the Member ID, full name, phone number, email (if any), and any other membership details.
3. They also set up the member's login (Member ID plus an initial password).
4. When they save, the system checks that the **Member ID is not already used**. If it is, the save is refused with a clear message.
5. The member is created as **active** and given the **Member** role.
6. The system then creates attendance rows for this member for **upcoming meetings only** (see 5.5). It does **not** create rows for meetings that already happened, so the member's percentage is not dragged down by meetings from before they joined.

### 5.3 Managing existing members

- An administrator with `members.view` can see and search the member list.
- An administrator with `members.edit` can change a member's details. Changing a Member ID must still respect the rule that IDs are unique.
- Members are **never deleted**. Instead, an administrator with `members.deactivate` marks them **inactive**. This is called a soft delete.
  - An inactive member keeps all their past attendance history, which stays in reports.
  - An inactive member gets **no new attendance rows** for future meetings.
  - An inactive member cannot log in.
  - An administrator can reactivate them later. From then on, they are included in newly created meetings again.

### 5.4 Scheduling a meeting

1. An administrator with `meetings.create` opens the New Meeting screen.
2. They enter a title, the date and the time. Meeting dates are **not fixed** in the system. Each one is created by an administrator.
3. When they save, the meeting is created with status **Scheduled**.
4. Immediately, the system creates an attendance row for **every active member**, all set to **Absent** with no recorded time (see 5.5).

### 5.5 Pre-generated attendance (the key idea)

Attendance rows are created in advance, not at check-in. This makes absence reports simple and accurate, because an absent member still has a row.

Rules:

- **When a meeting is created:** one row per **active** member, status **Absent**, recorded time empty.
- **When a new member is registered:** rows for **upcoming** meetings only, status **Absent**. Nothing is created for past meetings.
- **When a member is deactivated:** existing rows stay as they are. No new rows are created for them.
- **When a member is reactivated:** rows are created for upcoming meetings they don't already have. Past meetings are not backfilled.

### 5.6 Editing or cancelling a meeting

- An administrator with `meetings.edit` can change a meeting's title, date or time after it was created. All attendance records stay linked to the meeting, so nothing is lost.
- A meeting can also be **cancelled** (status becomes Cancelled). Its attendance rows are kept, but a cancelled meeting is **left out of all attendance percentages and counts**, and is clearly marked as cancelled wherever it appears.
- Meetings that have attendance recorded are never deleted. Cancelling is the way to remove them from consideration.

### 5.7 Taking attendance at a meeting

1. An administrator with `attendance.mark` opens the Attendance screen and selects the meeting.
2. They see the list of members for that meeting, all starting as **Absent**.
3. To mark someone, they type the **Member ID** in the Member ID field. The system finds the member and shows:
   - full name,
   - Member ID,
   - meeting date,
   - current attendance status,
   - time of attendance (if already marked).
4. The administrator confirms and marks the member **Present**. The system:
   - changes the status from Absent to Present,
   - records the **current time** as the attendance time,
   - records who marked it,
   - links it automatically to the right member and meeting.
5. A member who is never marked simply stays **Absent**.
6. If the Member ID does not exist, or belongs to an inactive member, or there is no row for that member in this meeting, the system shows a clear message and changes nothing.

The administrator can also mark directly from the meeting's member list instead of typing IDs.

### 5.8 Correcting attendance

Mistakes happen, so attendance can be corrected, but every correction is logged.

1. An administrator with `attendance.edit` opens a meeting's attendance and changes a member's status (Present to Absent, or Absent to Present).
2. The system saves the change **and** writes an entry to the change log: who made the change, when, the old status, and the new status.
3. When switching a member to Present, the attendance time is set to the time of the correction. When switching to Absent, the attendance time is cleared.
4. Attendance records can **never be deleted** by anyone. They can only be corrected, and every correction is visible in the log.
5. An administrator with `audit.view` can see the change log, filtered by member, meeting or person who made the change.

### 5.9 What a member sees

After logging in, a member sees a page containing only their own information:

- **Summary:** total meetings held, number present, number absent, and **attendance percentage** (present divided by total held, as a percentage).
- **History list:** each meeting with its date, time, and whether they were Present or Absent, plus the time their attendance was recorded where applicable.

Rules for what counts:
- Cancelled meetings are not counted.
- Meetings in the future that haven't happened yet are not counted in the percentage. Only meetings whose date has arrived are counted.
- The member can only look. There are no edit, delete or add buttons anywhere.

### 5.10 Reports

An administrator with `reports.generate` opens the Reports screen.

**Choose what to report on** (any combination):
- a specific meeting,
- a date range,
- an individual member,
- attendance status (Present or Absent),
- all registered members.

**Each report row contains:**

| Column | Meaning |
|---|---|
| Member ID | The member's unique number |
| Member Name | Full name |
| Meeting Date | Date of the meeting |
| Meeting Time | Scheduled time |
| Attendance Time | When the attendance was recorded (blank if absent) |
| Attendance Status | Present or Absent |

**What the administrator can do with a report:**
- View it on screen.
- Print it.
- With `reports.export`, download it as **PDF** or **Excel**.

Reports leave out cancelled meetings by default. Inactive members still appear for meetings they were part of, because their history is permanent.

### 5.11 Administrator dashboard

An administrator with `dashboard.view` lands on a dashboard showing:

- total registered members,
- number of scheduled meetings,
- for a selected meeting: number present and number absent,
- recent attendance records,
- quick links to register a member, schedule a meeting, take attendance, and open reports.

The dashboard only shows quick links to areas the administrator has permission to use.

---

## 6. Rules the system must always follow

1. **No duplicate Member IDs.** Ever.
2. **One attendance record per member per meeting.** Ever.
3. **Members are read-only.** A member can never change any attendance information.
4. **Members see only themselves.** Their identity always comes from their login session.
5. **Permissions are enforced on the server side**, not just by hiding buttons on the screen.
6. **Attendance history is permanent.** Nothing is hard-deleted: not members (they are deactivated), not meetings (they are cancelled), and not attendance records.
7. **Every attendance correction is logged** with who, when, old value and new value.
8. **Passwords are stored securely** and never shown in readable form.
9. **All forms validate their input** and show clear, friendly error messages.
10. **Cancelled meetings and future meetings** are excluded from percentages and attendance counts.

---

## 7. Screens to build

**For administrators (shown according to permissions):**
1. Login
2. Dashboard
3. Member list (with search and deactivate/reactivate)
4. New Member / Edit Member
5. Meeting list
6. New Meeting / Edit Meeting (including cancel)
7. Take Attendance (choose meeting, enter Member ID or tick from list)
8. Attendance Correction view
9. Attendance Change Log
10. Reports (filters, on-screen view, print, PDF and Excel export)
11. Role and permission management (already exists; just add the new permissions above)

**For members:**
1. Login (Member ID and password)
2. My Attendance (summary plus history)
3. Change password

---

## 8. Suggested build order

1. **Foundation:** add the new permissions and the Member role to the existing login and role system.
2. **Members:** register, list, edit, deactivate/reactivate.
3. **Meetings:** create, list, edit, cancel, with automatic creation of attendance rows.
4. **Taking attendance:** the Member ID lookup, marking Present, and the rules for edge cases.
5. **Corrections and change log.**
6. **Member view:** personal summary and history.
7. **Reports:** filters, on-screen view, then PDF and Excel export.
8. **Dashboard.**
9. **Polish:** validation messages, empty states, and testing every rule in section 6.

---

## 9. Out of scope

- Late or Excused attendance statuses.
- Automatic backups (the owner handles backups manually).
- Anything not described above.

---

## 10. Checklist to confirm the build is correct

- A new meeting produces an Absent row for every active member and none for inactive members.
- A newly registered member has rows for upcoming meetings only.
- Marking Present stores the time; correcting to Absent clears it; both are logged.
- A member logging in sees only their own data, and cannot reach any admin screen or change anything.
- An administrator without a given permission can neither see nor perform that action.
- Deactivated members keep their history but can't log in and get no new rows.
- Cancelled meetings never affect percentages.
- Reports match the on-screen data and export correctly to PDF and Excel.
- Attempting to register a duplicate Member ID is refused.