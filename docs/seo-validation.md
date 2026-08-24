# SEO Validation Notes

## Initial browser check

The rendered Pika homepage title is `Pika | Find Useful Conversations, People & Communities`, confirming that route-aware title updates are active in the client-rendered document.

The first metadata inspection used an invalid unquoted CSS attribute selector for the Open Graph title. The follow-up check will use quoted attribute values and validate the canonical URL, robots directive, Open Graph metadata, and JSON-LD separately.

## Rendered metadata verification

The homepage renders the expected title, description, canonical URL, Open Graph title, permissive public robots directive, and Organization/SoftwareApplication JSON-LD graph.

The `/dashboard` workspace renders the title `Pika Workspace`, the canonical workspace URL, a `noindex, nofollow` directive, and no public schema block. This preserves the intended boundary between public discovery pages and private workspace pages.

The `/faq` page renders its page-specific title, a public index/follow robots directive, canonical URL, and an `FAQPage` schema with five question-and-answer entries.
