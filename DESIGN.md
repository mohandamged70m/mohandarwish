# Design System — Mohand Darwish Portfolio

> Single source of truth for the software engineer portfolio. Black-base dark mode, wine/mahogany system, brutalist-grid + restrained glass.

---

## 1. Philosophy

- **Black base, wine system (dark)** — dark mode is `#0A0A0A` page base like before. All 5 mahogany/wine colors work hard on top: surfaces, borders, fills, hovers, badges (~25–35% viewport, up from 5–10%). Light mode unchanged (warm paper).
- **Brutalist Editorial + Terminal Hint** — `Space Grotesk` for identity (headings/hero), `IBM Plex Mono` for logo/nav/code/labels, `Inter` for readability (body).
- **High contrast, structural grid** — hairline rules (`border` / `border-strong`), sharp 0–4px radius, dense sections. Borders do the work, not shadows.
- **Glass is restrained** — flat cards/sections by default. Blur (`backdrop-filter`) allowed only for: floating nav, modal backdrop, dropdowns. Never for cards, hero, or long text.
- Reserve ember/wine accent for what should draw the eye: primary CTA, active nav pill, hover underlines, focus rings, key data points.
- 50/50 themes — dark and light must both pass AA (4.5:1 body) and look intentional. Neither is a fallback.

---

## 2. Color Palette

### Background & Structure

| Token | Hex (dark) | Hex (light) | Usage |
|---|---|---|---|
| `bg-primary` | `#0A0A0A` | `#FAF6F0` | Main page background — black dark (like before), warm paper light |
| `bg-surface` | `#250902` | `#FFFFFF` | Cards, nav bar, elevated sections — mahogany #1 |
| `bg-surface-hover` | `#38040E` | `#F5ECE4` | Card hover, nav hover — mahogany #2 |
| `border` | `#640D14` | `#E8D5CC` | Dividers, card borders, input outlines — hairline grid |
| `border-strong` | `#AD2831` | `#D6BFAF` | Hover borders, emphasis, brutalist rules — brightest wine for visibility on black |

> User 5 mapped dark: `#250902` → bg-surface, `#38040E` → bg-surface-hover, `#640D14` → border, `#800E13` → accent-fill-hover / section tint, `#AD2831` → border-strong + accent-fill. Black `#0A0A0A` restored as bg-primary. Light unchanged.

### Accent — Ember / Wine

| Token | Hex (dark) | Hex (light) | Usage |
|---|---|---|---|
| `accent-primary` | `#AD2831` | `#800E13` | Solid fills: primary CTA bg, active pill bg, key highlights — full wine |
| `accent-text` | `#E8624A` | `#800E13` | Text/links/focus on dark black — bright ember passes AA where `#AD2831` text fails; light reuses wine |
| `accent-hover` | `#800E13` | `#640D14` | Hover/pressed state — deeper wine |
| `accent-soft` | `#38040E` | `#FBE4DA` | Subtle backgrounds, badges, tags, code blocks — mahogany #2 on black |
| `accent-soft-text` | `#FFD9CC` | `#5A0A10` | Text on soft bg (contrast-safe) |
| `accent-ring` | `rgba(173,40,49,0.35)` | `rgba(128,14,19,0.14)` | Glow / focus ring — wine on black |

### Text

| Token | Hex (dark) | Hex (light) | Usage |
|---|---|---|---|
| `text-primary` | `#FFF7ED` | `#250902` | Headings, primary body copy |
| `text-secondary` | `#D8BFAF` | `#6B4A3E` | Muted text, captions, metadata |
| `text-muted` | `#A68A7A` | `#A08A7D` | Placeholders, disabled |
| `text-on-accent` | `#FFF7ED` | `#FFFFFF` | Text on solid wine buttons — warm white on `#AD2831` / `#800E13` |

### Usage Rules

- Keep wine to **~25–35% of dark viewport** (up from 5–10%): cards, nav, badges, code blocks, table headers, hovers, active states all wine-tinted. Black `#0A0A0A` stays as breathing room.
- Dark glow for primary CTAs only: `box-shadow: 0 0 20px rgba(173,40,49,0.35)` (`--shadow-accent`).
- `border` at `#640D14` on `#0A0A0A` is the visible brutalist hairline — must read as a rule, not disappear. `border-strong #AD2831` for required dividers.
- Dark text rule: never use `#AD2831` / `#800E13` as small body/link text on black (fails AA) — use `accent-text #E8624A` for links/focus. Wine is for fills, surfaces, borders.
- Light theme untouched — paper `#FAF6F0` + wine text `#250902`.
- Implemented in `app/globals.css` (`:root` dark + `.light` override). Docs and code in sync.

---

## 3. Typography

| Role | Font | Stack |
|---|---|---|
| Headings / Hero | `Space Grotesk` | `var(--font-display)` → `'Space Grotesk', sans-serif` |
| Logo / Nav / Labels / Code | `IBM Plex Mono` | `var(--font-heading)` → `'IBM Plex Mono', monospace` |
| Body / UI | `Inter` | `var(--font-body)` → `'Inter', -apple-system, sans-serif` |

Loaded via `next/font/google` in `app/layout.tsx` with `display: swap` and CSS variables `--font-space-grotesk` / `--font-plex-mono` / `--font-inter`.

### Type Scale

| Element | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| H1 / Hero name | Space Grotesk | 48–64px | 700 | -0.02em |
| H2 / Section titles | Space Grotesk | 28–32px | 600 | -0.015em |
| H3 / Card titles | Space Grotesk | 18–20px | 600 | normal |
| Logo / Nav / Eyebrow | IBM Plex Mono | 13–15px | 500 | +0.04em uppercase for eyebrows |
| Body | Inter | 16px | 400 | normal |
| Small / Caption | Inter | 14px | 400 | normal |
| Code snippets | IBM Plex Mono | 13–14px | 400/500 | normal |

> Both rule: Grotesk carries voice, mono carries system. Never set body paragraphs in mono. Limit mono eyebrows to one per section. One H1 per page.

---

## 4. CSS Variables

Live state in `app/globals.css`. Dark is default (`:root` + `color-scheme: dark`); `.light` / `html.light` overrides for `next-themes` (`attribute="class"`).

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-surface: #250902;
  --bg-surface-hover: #38040e;
  --border: #640d14;
  --border-strong: #ad2831;
  --accent-primary: #ad2831;
  --accent-text: #e8624a;
  --accent-hover: #800e13;
  --accent-soft: #38040e;
  --accent-soft-text: #ffd9cc;
  --accent-ring: rgba(173, 40, 49, 0.35);
  --text-primary: #fff7ed;
  --text-secondary: #d8bfaf;
  --text-muted: #a68a7a;
  --text-on-accent: #fff7ed;
  --font-display: var(--font-space-grotesk);
  --font-heading: var(--font-plex-mono);
  --font-body: var(--font-inter);
  --radius-sm: 4px;
  --radius-md: 8px;
  --shadow-accent: 0 0 20px rgba(173, 40, 49, 0.35);
  color-scheme: dark;
}

.light, html.light {
  --bg-primary: #faf6f0;
  --bg-surface: #ffffff;
  --bg-surface-hover: #f5ece4;
  --border: #e8d5cc;
  --border-strong: #d6bfaf;
  --accent-primary: #800e13;
  --accent-hover: #640d14;
  --accent-soft: #fbe4da;
  --accent-soft-text: #5a0a10;
  --accent-ring: rgba(128, 14, 19, 0.14);
  --text-primary: #250902;
  --text-secondary: #6b4a3e;
  --text-muted: #a08a7d;
  --text-on-accent: #ffffff;
  --shadow-accent: 0 0 20px rgba(128, 14, 19, 0.12);
  color-scheme: light;
}
```

### Tailwind v4 Mapping

Inside `@theme inline` in `app/globals.css`:

```css
@theme inline {
  --color-bg-primary: var(--bg-primary);
  --color-bg-surface: var(--bg-surface);
  --color-accent: var(--accent-primary);
  --color-text-primary: var(--text-primary);
  --font-display: var(--font-space-grotesk);
  --font-heading: var(--font-plex-mono);
  --font-body: var(--font-inter);
  /* enables: bg-bg-primary, text-text-primary, font-display, font-heading, etc. */
}
```

Use as: `bg-bg-primary`, `bg-bg-surface`, `border-border`, `text-text-secondary`, `bg-accent`, `font-display`, `font-heading`.

---

## 5. Components

### Buttons — `components/ui/button.tsx`

| Variant | Classes |
|---|---|
| `primary` | `bg-accent text-text-on-accent` → hover `bg-accent-hover` + `shadow-accent` |
| `secondary` | `border border-border text-text-primary` → hover `border-accent text-accent` |
| `ghost` | `text-text-secondary` → hover `text-accent bg-bg-surface` |

Sizes: `sm` `px-3 py-1.5`, `md` `px-5 py-2.5`, `lg` `px-8 py-3`. All `rounded-sm` (4px, brutalist — kills pill), `font-heading` (mono) for labels, uppercase 13px for `sm`.

```tsx
import { Button } from "@/components/ui/button";
<Button variant="primary">Hire me</Button>
<Button variant="secondary">View projects</Button>
```

### Cards — `components/ui/card.tsx`

```
bg: var(--bg-surface)
border: 1px solid var(--border) — must read as hairline
radius: var(--radius-md) → 8px (was 12px)
hover: border → var(--border-strong), bg → var(--bg-surface-hover)
NO blur / NO glass on cards
```

### Badges — `components/ui/badge.tsx`

| Variant | Usage |
|---|---|
| `default` | `bg-bg-surface border-border text-text-secondary` mono 12px uppercase |
| `accent` | `bg-accent text-text-on-accent` — primary tag |
| `soft` | `bg-accent-soft text-accent-soft-text` — subtle, contrast-safe in both themes |

### Links

- Default: `text-text-secondary`
- Hover: `text-accent-text` (dark, `#E8624A`) / `text-accent` (light) + underline (1px offset 3px) — never wine `#AD2831` text on black
- Active nav pill: `bg-accent/15 text-text-primary` + `ring-accent/30` + wine border (`components/layouts/nav.tsx`)

### Code Blocks

- `bg: var(--bg-surface)` (`#250902` on black base), `font: var(--font-heading)` (IBM Plex Mono), keywords in `var(--accent-text)` dark / `var(--accent-primary)` light, radius `4px`, border `1px solid var(--border)`.

### Nav — `components/layouts/nav.tsx`

- Floating pill → floating bar: `bg-bg-surface/80 backdrop-blur` + `border-border` — one of 3 allowed glass surfaces
- Logo: `font-heading` mono 15px
- Section links: `font-heading` mono 13px uppercase
- Active indicator: `motion.span` with `bg-accent/10 ring-accent/20`
- Theme toggle: `bg-bg-surface border-border`

---

## 6. Global Styles — `app/globals.css`

- `html` / `body` → `bg-bg-primary`, `font-body`, antialiased, `transition: background-color 0.2s` (disabled for `prefers-reduced-motion`).
- `color-scheme: dark` on `:root`, `light` on `html.light`.
- Headings `h1-h3` → `font-display` (Space Grotesk). `h4`, `nav`, `.eyebrow` → `font-heading` (mono).
- `*:focus-visible` → `outline: 2px solid var(--accent-primary)`.
- `::selection` → `bg-accent` / `text-on-accent`.
- Scrollbar → `border-strong` thumb, `bg-primary` track.
- Glass utility allowed only as `.glass-nav`, `.glass-modal`, `.glass-dropdown`. Delete generic `.glass-panel` from cards.

---

## 7. Accessibility Notes

- Dark: `text-primary #FFF7ED` on `bg-primary #0A0A0A` → ~15:1 (AAA).
- Dark: `text-secondary #D8BFAF` on `#0A0A0A` and `#250902` → must hold 4.5:1, verify.
- Dark fills: `text-on-accent #FFF7ED` on `accent #AD2831` → ~7:1 target, verify — white-on-wine only, never wine-on-black text.
- Dark links: use `accent-text #E8624A` on `#0A0A0A` for AA; `#AD2831` text on black fails — banned for small text.
- `text-on-accent #FFFFFF` on `accent #800E13` (light) → ~9:1 target, verify.
- `accent-soft-text` pairs are contrast-fixed for badges — do not swap.
- `border #640D14` must remain distinguishable from `bg-primary` at 1px — check on low-brightness screens.
- Verify all pairs with tooling before code migration; ratios above are targets, not measured.

---

## 8. File Map

| File | Role |
|---|---|
| `app/globals.css` | Tokens + Tailwind theme, `color-scheme` + light/dark overrides — matches §4 |
| `app/layout.tsx` | Font loading (`Inter`, `Space_Grotesk`, `IBM_Plex_Mono`), `Providers` wrapper, body bg/text |
| `components/layouts/providers.tsx` | `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`) + `ReducedMotionProvider` |
| `components/layouts/nav.tsx` | Bar nav + theme toggle — first consumer, allowed glass |
| `components/ui/button.tsx` | Button variants (uses `--accent-ring` for glow), sharp radius |
| `components/ui/card.tsx` | Card + subcomponents, flat, no blur |
| `components/ui/badge.tsx` | Badge variants (`soft` uses `accent-soft-text`) |

---

## 9. Do / Don't

- **Do** push wine harder in dark: mahogany surfaces, wine borders, wine fills, wine hovers — black is the canvas, wine is the system.
- **Do** use `accent-text` for dark links/focus, `accent-primary` wine for dark fills.
- **Do** use `font-display` for hero/titles, `font-heading` mono for nav/logo/code/labels, `font-body` for paragraphs.
- **Do** use hairline `border` as the grid — sections separated by rules, not space alone.
- **Don't** put accent backgrounds behind long text blocks (use `accent-soft` + `accent-soft-text` for tags only).
- **Don't** use mono or Grotesk for body copy.
- **Don't** apply `shadow-accent` to every card — only primary CTA.
- **Don't** apply glass/blur to cards, hero, or body sections.
- **Don't** reintroduce lime `#A3E635` or pill radius — deprecated.

---

*Last updated: 2026-09-08. Dark: black #0A0A0A base + wine system. Light: warm paper + wine. Implemented across portfolio (tokens, fonts, buttons, badges, nav, sections).*
