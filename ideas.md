# Slice AI Clone — Ground-Truth Design Specification

## Chosen Approach: Reference-Faithful Reconstruction

This project is a direct reconstruction of the live Slice AI Webflow site at `https://sliceai.webflow.io/`. The live source is the sole visual and interaction authority. Fidelity to its rendered geometry, typography, responsive behavior, copy, imagery, navigation, and micro-interactions overrides the normal requirement to invent an original visual direction.

## Design Movement

The design movement will be identified from the live reference through viewport-by-viewport inspection. The implementation will reproduce—not reinterpret—the visual language observed on the source site.

## Core Principles

1. Source-first: each visible element, state, route, and breakpoint derives from the observed reference.
2. Geometric accuracy: spacing, content widths, media crops, and type wrapping are treated as measurable layout constraints.
3. Asset fidelity: original public assets are reused whenever technically available; fallbacks must recreate their observed visual role closely.
4. Functional equivalence: navigation, accordions, forms, menus, links, and responsive patterns should behave as they do on the reference.

## Color and Typography Philosophy

Color tokens, font families, weights, scale, line height, letter spacing, border treatments, shadows, and radii will be extracted from the reference and centralized in reusable CSS variables. No arbitrary palette or font substitution will be introduced unless the original is technically unavailable.

## Layout Paradigm

All page structure will follow the source site's actual section sequencing, container model, grid behavior, and mobile reflow. Every route will share a source-matched global navigation and footer where present.

## Signature Elements

The implementation will use the reference site's actual brand mark, visual motifs, and recurring interface patterns whenever their public assets can be discovered. Original generated fallback assets are reserved only for cases where source assets are unavailable and will not displace a discoverable reference asset.

## Interaction and Animation Philosophy

Transitions and interaction states will mirror the observed reference. Motion will be restrained to source-derived behavior and will respect `prefers-reduced-motion`.

## Brand Essence

**Slice AI — the reference AI product site, reconstructed for side-by-side visual comparison.**

The source brand’s own positioning, personality, headline voice, calls-to-action, logotype, and signature color will be extracted directly from the live site rather than rewritten.

## Implementation Reminder

Every page, component, and CSS file added for this project must begin with a concise comment indicating that it implements this reference-faithful reconstruction and must avoid any choice that dilutes source fidelity.
