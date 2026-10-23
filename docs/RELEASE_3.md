# Pockit 3.0 local release notes

This is an unpublished upgrade of the existing application. No cloud resources, credentials, paid subscriptions or deployment were created.

## What changes
- Five primary sections: Home, School, Money, Calendar and Tasks. Money contains the existing Plan, Goals, Activity and transportation tools.
- Account custody, transfers and explicit balance corrections; Low Funds Mode and purchase simulations. Legacy transactions retain their exact history under an explicit unassigned account.
- Account-aware commute recording, fare comparisons and direct undo.
- Offline manual courses, assignments, configurable grade categories, task recurrence, study timer/history and study suggestions.
- Unified academic/financial event ranges, editable manual events, in-app notifications and a real-data daily briefing.
- Read-only FEU Canvas gateway adapter with tested error handling and atomic cache merging. It is disabled until an approved protected HTTPS service is configured.

## Data and recovery
- Data format 3 and IndexedDB schema 4. Existing version-1 and version-2 backups migrate on restore. Upgrades save recovery copies in the same transaction; failed validation aborts the upgrade.
- The app database name remains `pockit-v1`. Never delete it to resolve an upgrade issue.
- Export through Settings before release or switching devices. Version-3 exports include financial records, accounts, manual academics, Canvas cache, tasks, events, timers and study history. They are plain JSON and should be kept private.
- Older app builds reject version-3 backups. Keep an original version-2 export if an application downgrade might be needed. The app's recovery section also exposes pre-upgrade copies.
- Account transfers and balance corrections never count as income or expenses. Savings goals remain allocations within owned assets; moving money to a savings-type account does not automatically allocate a goal contribution.

## Explicit limitations
- Live FEU authorization has not been connected. FEU's public site uses Microsoft SAML login; availability of third-party OAuth keys or personal tokens remains unconfirmed. The protected backend and its authorization tests must be completed and approved before enabling `VITE_CANVAS_GATEWAY`. Never put a Canvas token or client secret in a Vite variable.
- Optional cross-device cloud sync remains unimplemented. Local operation and export/restore work independently. Provider comparison and security requirements are in INTEGRATION_PLAN.md.
- In-app reminders and saved timer timestamps do not imply scheduled background push. The timer is checked when the application runs or resumes.
- Grade projections depend on the entered assessment list and weights. Ungraded work is excluded from the current grade; missing future assessments make projections incomplete. Canvas grades are displayed separately rather than inferred from manual rules.
- Study suggestions use the calendar, effort estimates and available hours. They are proposals requiring confirmation, not a guarantee of sufficient time.
- WebKit automation is additional compatibility evidence, not a physical iPhone XS Max test or a 60 FPS claim. Hardware keyboard, notch, suspension and battery behavior still need physical verification.

## Release gate
Build/typecheck, lint, 69 unit tests and all 17 distinct browser workflows pass in Edge (including targeted retests) and WebKit. Migration/restore, offline persistence, accessibility and responsive checks pass. See ASTRA_PROGRESS.md for measured WebKit performance limitations. Physical-device acceptance and remaining integration work are still required before requesting deployment approval. No push or deployment without explicit approval.
