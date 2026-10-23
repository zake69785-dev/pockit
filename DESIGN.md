# Pockit 3.0 — Lovable visual integration

Visual authority: the private first-light-collective reference at commit 778cbc2c39e43b4e9037813485eaa33aee29b67b. Its cozy stationery direction replaces the prior visual reference while existing Pockit data, calculations and navigation destinations remain authoritative.

The application uses locally hosted Nunito body text and Fraunces display text, the reference mascot, warm paper OKLCH surfaces and cobalt accents. Yellow marks the primary expense action; mint marks positive savings states. Navy surfaces and lighter ink/accent tones form the separate dark theme. Shared tokens are defined in src/theme.css; src/styles.css owns layout primitives without a second competing token palette.

Cards use 24px corners, controls 14px and a 4/8/12/16/24/32px spacing scale. Financial amounts use tabular numerals and targeted wrapping. Headings use actual content; financial figures always come from the existing engine. No demo-reset controls, sample records, or Lovable storage implementation are shipped.

Home prioritizes safe spending and quick actions, then compact briefing cards and expandable details. Desktop widths of 1050px and above use a sidebar; mobile retains five primary navigation destinations. Plan, Goals, Activity and Transportation remain accessible from Money. Settings remains in the header. Returning-user setup behavior is preserved.

Select uses Radix for keyboard navigation, focus, typeahead and portalled menus; a hidden native form control preserves actual values and constraint validation. Within a modal, menus portal into its top layer. SelectionSheet provides searchable icon radio selection and checkbox multiselect using native dialog, explicit apply/cancel, safe areas and visual-viewport height limits. Account search appears for collections above five accounts. Reminder categories use multiselect. Date/time and numeric controls stay native.

Motion is limited to short transform/opacity feedback and existing purposeful transitions. Select opens in 140ms, existing route transitions use 220ms, reduced motion removes movement. The reference's continuous mascot float is omitted. Touch hover styling is gated by device capability.

Target viewports are 360/414/1280/1600 × 896 CSS pixels. Browser screenshots and DOM checks use synthetic isolated profiles. Physical iPhone XS Max acceptance is separate and has not been performed. Notification architecture and approval restrictions are documented in docs/PUSH_ARCHITECTURE.md.
