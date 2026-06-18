---
name: Framer Motion overrides CSS transform utilities
description: When a motion element animates x/y/scale, Tailwind hover:translate/scale on that same element silently fails.
---

On any element that is a Framer `motion.*` AND animates a transform (via `animate`, `whileInView`, `initial`, or a looping `animate`), Framer writes an inline `transform` style that overrides Tailwind transform utilities like `hover:-translate-y-1` / `hover:scale-[1.02]`. The hover simply does nothing.

**Why:** Framer composes the full `transform` property from its x/y/scale/rotate props and writes it inline; inline style beats class-based transforms.

**How to apply:**
- Put transform-based hover on the motion element via `whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2, ease } }}` instead of CSS classes. A per-gesture `transition` inside the `whileHover` object overrides the component's shared `transition` (e.g. a slow 0.5s entry).
- OR move the hover effect to a plain (non-motion) child element — CSS hover transforms work there.
- Non-transform hovers (bg/border/color/shadow) are fine to keep as Tailwind classes on the motion element.
- For static positioning on a motion element that loops `animate={{y:[...]}}`, center horizontally with margin (`-ml-5`) not `-translate-x-1/2`, since the translateX would be overridden too.

This bit twice in the Harmonic home page: the slogan-strip chevron and the feature cards.
