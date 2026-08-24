# Slice AI Precision Audit

## Baseline

The live source homepage loaded successfully in an isolated browser and was captured at **1440 × 900** as the desktop comparison baseline. The live source continues to use the public Slice A Webflow title and its original styles/assets. All fidelity decisions in this pass will be based on repeatable original-versus-clone comparisons, not generic design conventions.

## Comparison Matrix

| Priority | Routes | Viewports | Focus |
| --- | --- | --- | --- |
| P0 | Home, Pricing, Features | 1440×900, 1280×800, 1024×768 | Header geometry, hero structure, typography, section order, source assets |
| P1 | About, FAQ, Blog, Contact | 768×1024, 430×932, 390×844 | Shared sections, cards, footer, mobile navigation, form geometry |
| P2 | CMS detail, legal, admin, 404, password | 1280×800, 375×812 | Route integrity, detail layouts, error states, source-specific assets |

## Initial Verification Priorities

The first comparisons will prioritize the shared navigation and hero because they appear on the highest-traffic pages and establish the visual anchors for container width, typography, button geometry, and responsive breakpoints. The audit will then continue through repeated cards, footer, interaction states, and route-specific layouts.

## Measured Source Findings — Home at 1440×900

The source navigation has an **82px** total height. Its shared desktop container spans from **x=48px to x=1392px** for a width of **1344px**, confirming the source uses a much wider desktop container than the current clone. The primary hero content begins at **y=169px** inside a `1342px` wide source box. The source headline uses Cal Sans at **54px** with a **67.5px** line height, and its central text column measures **812px** wide. These are P0 anchors for the fine-tuning pass.

## Confirmed P0 Differences — Clone at 1440×900

| Element | Source | Clone | Required correction |
| --- | --- | --- | --- |
| Shared desktop container | 1344px wide, x=48px | 1090px wide, x=175px | Expand desktop content system to the measured 1344px source width. |
| Navigation | 82px tall, no added top/bottom padding | 84px tall, 16px vertical header padding | Match the compact 82px source navigation geometry. |
| Hero box | x=49px, y=169px, 1342×819px | x=175px, y=100px, 1090×655px | Recreate the substantially wider, lower, and taller source hero container. |
| Primary heading | 812px column, 54px / 67.5px | 700px column, 79.2px / 77.6px | Reduce desktop heading scale and match source text-column width and vertical placement. |
| Primary control | 50px tall, 20px radius, 24px text-side inset | 44px tall, pill radius | Match source control height, radius, and internal padding. |

## Measured Source Findings — Home at 375×812

The source switches to its mobile navigation at this viewport: the navigation height is **70px**, the wrapper begins at **x=7px**, the logo control is **112×38px**, and the menu trigger is a **49×49px** control positioned at `x=314px, y=14px`. The mobile hero begins at `x=15px, y=148px`, measures **345×532px**, and has a **38px / 47.5px** Cal Sans headline spanning the full 345px hero width. The source body copy remains 14px / 21px and measures 323px wide. These measurements establish the target mobile hero and header behavior.

## Confirmed Mobile Differences — Clone at 375×812

The clone header is **76px** rather than the source **70px**; its content begins at `x=16px` rather than `x=7px`; its logo is too small at **96×20px** rather than **112×38px**; and its menu trigger is **42×42px** instead of **49×49px**. The clone hero begins too early (`y=92px` rather than `y=148px`), is too short (**500px** rather than **532px**), and uses a smaller content width (**343px** rather than **345px**). Its heading is too large and tight (**43.68px / 42.8px**) relative to the source **38px / 47.5px**, while body copy is too large at **15.2px / 22.8px** instead of **14px / 21px**.

## Corrected and Rechecked

The adjusted clone now matches the original desktop homepage’s measured hero container (`y=169px`, `1344×819px`), heading offset (`y=225px` within the same `812px` central column), 54px / 67.5px headline typography, source paragraph width and 16px / 24px type, and 82px header. The shared static PageHero used by pricing and related routes has also been rechecked against the original pricing page: its heading now begins at `y=172px` at 54px / 67.5px, while the description begins at `y=252px` with the exact 501px width and 16px / 24px typography of the source.

The pricing plan grid has also been rechecked against the original source. At 1440×900, the clone now places cards at `(48, 512, 457×553)`, `(513, 512, 435×553)`, and `(956, 512, 435×553)`, which matches the source’s measured three-card geometry apart from the source’s final 1px rightmost horizontal offset.

At 375×812, the shared static PageHero has been verified to match the original pricing route exactly for heading and body geometry: the 40px / 50px heading begins at `(14, 147)` and measures `347×100px`, while the 14px / 21px description begins at `(14, 257)` and measures `347×84px`.
