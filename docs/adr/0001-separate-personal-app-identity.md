---
status: accepted
---

# Package the personal fork as a separate application

Both development Macs already run the official GenOffice application. The
personal fork will therefore be packaged as `GenOffice Cursor.app` with the
bundle identifier `com.ryukouokumura.genoffice.cursor` and the explicit
`~/Library/Application Support/GenOffice Cursor` user-data directory, rather
than replacing the official `GenOffice.app`. This preserves official updates
and data while allowing the personal Cursor integration to be developed and
installed independently.

## Considered options

- Replacing the official app was rejected because the current fork shares its
  name, bundle identifier, user data, file associations, and update lineage.
- Running only an unpackaged development process is the MVP workflow, but it is
  not the intended long-term daily-use experience on two Macs.
- A separate application identity was selected so both versions can coexist
  and be rolled back independently.

## Consequences

- The fork must not be packaged for installation until its product name,
  bundle identifier, and packaged user-data path are all separated.
- The personal build must never consume the official update feed. It is updated
  by rebuilding and reinstalling on each Mac unless a separate private update
  system with its own URL and consistent Apple signing is designed later.
- Preferences, autosaves, projects, credentials, and skills are not implicitly
  shared between the official and personal apps. Any migration must be
  selective rather than a wholesale copy of the user-data directory.
