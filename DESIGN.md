# Pockit 2.0 design system

The user selected a cheerful cream, blue, yellow and mint direction inspired by JuJuly Cafe's energy. The design does not copy its layout, mascot or branding. Pockit's signature is its own pocket-and-coin mark, a strong blue daily guide, and approachable lettering.

Theme and interaction tokens live in `src/theme.css`; common layout and form primitives remain in `src/styles.css`. Blue #3265D8 is the main action/data color, yellow #FFD65A highlights the most frequent action, mint supports savings, and cream #FFFDF6 makes the light background warm. Navy #111C32, elevated blue-gray surfaces, softer blues and brighter mint form the independently adjusted dark theme. Body text remains high contrast. DM Sans stays locally hosted.

Cards use 24px radii, controls 14px, 4/8/12/16/24/32px spacing, 140/220ms state transitions and a restrained spring for sheets. Motion changes transform/opacity, respects reduced motion, and never counts financial amounts through ambiguous intermediate values. Goal bars animate their scale; the actual amount is always immediately readable.

Home answers today's safe-spend question first, then offers five quick actions. Bottom navigation: Home, Plan, Calendar, Goals, Activity. Settings is a consistent header button. Setup and transportation are focused flows. Native dialog sheets preserve focus, Escape and tap alternatives to swiping. Every meaningful financial illustration is data-driven; the welcome pocket is original geometric brand artwork.

The primary target is 414 × 896 CSS pixels, with safe-area insets, 16px form inputs and dynamic-viewport sheet constraints for iOS 18.7.10. Desktop uses a two-column canvas. Theme preference is mirrored to localStorage solely for a synchronous pre-paint theme; IndexedDB remains authoritative.
