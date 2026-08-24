# Slice AI Motion and Micro-Detail Audit

## Source Motion Baseline

The original homepage exposes **79** Webflow interaction nodes (`data-w-id`) and begins with six active Web Animations after the initial load. The homepage contains distinct scroll-animation zones at approximately `y=0`, `1093`, `1151`, `2068`, `2652`, `3498`, `4447`, `5061`, `6187`, `7190`, and `7931` pixels on the 1440px desktop source viewport.

## Observation Protocol

Each target will be approached from above, then paused after every deliberate scroll increment. The source sequence will be allowed to settle for at least 1.5 seconds before its transforms, opacity, and visible state are recorded. The clone will be checked against the recorded settled state and any verified timing will be implemented with `prefers-reduced-motion` support.

## Early Transition — Settled States

At `y=700–1420px`, the source keeps the fixed navigation fully opaque while the hero media and next main-feature heading remain at their settled identity transforms. The observed data shows no persistent translated or hidden state after an 1.8-second pause; this identifies the visible effect as a finite, reveal-on-enter sequence rather than a continuously scrubbed transform for these first sections. The clone should use a one-time staggered reveal that completes before the user continues scrolling, rather than an always-running or abrupt static entry.

## Middle and Late Transitions — Observed Motion

The source applies short finite zoom reveals to the “Discover what is Slice AI” and “AI Powered Assistant” text groups. The settled transforms after a deliberate scroll step were near `scale(1.075)` and `scale(1.016)` respectively, with opacity fully restored. These groups therefore need a modest, not exaggerated, entry scale and a complete pause before further scrolling.

The compatibility/circle section is the most visibly scroll-reactive source zone. Its layered logos settle with individual translations ranging from about **−34px to +19px** horizontally and **−50px to +19px** vertically. The three large circles settle at progressively different scales, roughly **0.50–0.93**, while the heading and CTA settle with a restrained scale just above 1.0. This defines a parallax composition with slow, non-identical layers rather than a uniform entrance animation. Later blog cards do not retain a non-identity settled transform after their reveal.

## Verified Source Timing

The source’s reusable `slideInBottom` viewport animation begins at opacity `0` and `translateY(100px)`, then completes both opacity and transform over **1000ms** using **outQuart**. The navigation hides on downward scrolling by translating `−100px` over **300ms**, then restores to `0` over the same duration on upward scrolling. Its notification bar follows a smoothed `SCROLL_PROGRESS` rule: it remains at `translateY(126px)` through the first 25% of the trigger range, transitions to `0px` by 31%, and uses a configured **500ms** response duration. The navigation color transition uses the same 500ms smoothed scroll-progress configuration.

## Clone Replay Results

The clone now reveals the hero, feature heading, visual, discovery, assistant, trust, compatibility, number, and blog groups progressively as they enter the viewport. The first reveal settles within the intended 1000ms window, and no current browser-console errors are reported. Its header moves by its full 82px height on downward scroll and returns to its identity transform within the source-matched 300ms upward-scroll window. The animation layer honors reduced-motion preferences by rendering reveal targets immediately without transitions.
