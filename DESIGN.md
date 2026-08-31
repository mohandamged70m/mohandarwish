# Design System — Mohand Darwish Portfolio

> Single source of truth for the software engineer portfolio. Dark-first, lime-accent, terminal-inspired.

---

## 1. Philosophy

- **Black dominates** — ~90% of UI is `#0A0A0A` / `#151515`. Green is an accent only (5–10%).
- **Terminal + Editorial** — `JetBrains Mono` for identity (headings/logo/nav), `Inter` for readability (body).
- **High contrast, low noise** — no gradients, no glassmorphism. Borders and subtle hover states do the work.
- Reserve green for what should draw the eye: name/logo, primary CTA, active nav pill, hover underlines, tech-stack icons.

---

## 2. Color Palette

### Background & Structure

| Token | Hex (dark) | Hex (light) | Usage |
|---|---|---|---|
| `bg-primary` | `#0A0A0A` | `#FAFAF9` | Main page background — note light mirrors dark hierarchy (surface lighter than primary) |
| `bg-surface` | `#151515` | `#FFFFFF` | Cards, nav bar, elevated sections |
| `bg-surface-hover` | `#1C1C1C` | `#F5F5F5` | Card hover, nav hover |
| `border` | `#1F1F1F` | `#E7E5E4` | Dividers, card borders, input outlines |
| `border-strong` | `#2A2A2A` | `#D6D3D1` | Hover borders, emphasis |

### Accent — Lime

| Token | Hex (dark) | Hex (light) | Usage |
|---|---|---|---|
| `accent-primary` | `#A3E635` | `#65A30D` | Links, active states, CTAs, highlights |
| `accent-hover` | `#84CC16` | `#4D7C0F` | Hover/pressed state |
| `accent-soft` | `#D9F99D` | `#ECFCCB` | Subtle backgrounds, badges, tags |
| `accent-soft-text` | `#0A0A0A` | `#365314` | Text on soft bg (fixes contrast) |
| `accent-ring` | `rgba(163,230,53,0.15)` | `rgba(101,163,13,0.15)` | Glow / focus ring |

### Text

| Token | Hex (dark) | Hex (light) | Usage |
|---|---|---|---|
| `text-primary` | `#F5F5F5` | `#1C1917` | Headings, primary body copy — warm stone-900 in light |
| `text-secondary` | `#A1A1A1` | `#78716C` | Muted text, captions, metadata — stone-500 |
| `text-muted` | `#737373` | `#A8A29E` | Placeholders, disabled — stone-400 |
| `text-on-accent` | `#0A0A0A` | `#FFFFFF` | Text on solid green buttons |

### Usage Rules

- Keep green to **~5–10%** of viewport.
- Optional terminal glow for primary CTAs only: `box-shadow: 0 0 20px rgba(163,230,53,0.15)` (`--shadow-accent`).
- `border` at `#1F1F1F` on `#0A0A0A` is subtle by design; use `border-strong` when divider must be visible.

---

## 3. Typography

| Role | Font | Stack |
|---|---|---|
| Headings / Logo / Nav | `JetBrains Mono` | `var(--font-heading)` → `'JetBrains Mono', monospace` |
| Body / UI | `Inter` | `var(--font-body)` → `'Inter', -apple-system, sans-serif` |
| Code snippets | `JetBrains Mono` | `var(--font-heading)` |

Loaded via `next/font/google` in `app/layout.tsx:1` with `display: swap` and CSS variables `--font-inter` / `--font-jetbrains`.

### Type Scale

| Element | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| H1 / Hero name | JetBrains Mono | 48–64px | 700 | -0.02em |
| H2 / Section titles | JetBrains Mono | 28–32px | 600 | -0.015em |
| H3 / Card titles | JetBrains Mono | 18–20px | 600 | normal |
| Body | Inter | 16px | 400 | normal |
| Small / Caption | Inter | 14px | 400 | normal |
| Nav links | JetBrains Mono | 14–15px | 500 | normal |

> Limit mono to one H1 per page; overuse feels loud. Body paragraphs stay in `Inter`.

---

## 4. CSS Variables

Defined in `app/globals.css:3`. Dark is default (`:root` + `color-scheme: dark`); `.light` / `html.light` overrides for `next-themes` (`attribute="class"`).

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-surface: #151515;
  --bg-surface-hover: #1c1c1c;
  --border: #1f1f1f;
  --border-strong: #2a2a2a;
  --accent-primary: #a3e635;
  --accent-hover: #84cc16;
  --accent-soft: #d9f99d;
  --accent-soft-text: #0a0a0a;
  --accent-ring: rgba(163, 230, 53, 0.15);
  --text-primary: #f5f5f5;
  --text-secondary: #a1a1a1;
  --font-heading: var(--font-jetbrains);
  --font-body: var(--font-inter);
  color-scheme: dark;
}

.light, html.light {
  --bg-primary: #fafaf9; /* stone-50 — page slightly off-white */
  --bg-surface: #ffffff; /* cards pure white */
  --border: #e7e5e4;      /* stone-200 */
  --accent-primary: #65a30d;
  --accent-soft: #ecfccb;
  --accent-soft-text: #365314;
  --text-primary: #1c1917;
  color-scheme: light;
}
```

### Tailwind v4 Mapping

Inside `@theme inline` in `app/globals.css:38`:

```css
@theme inline {
  --color-bg-primary: var(--bg-primary);
  --color-bg-surface: var(--bg-surface);
  --color-accent: var(--accent-primary);
  --color-text-primary: var(--text-primary);
  --font-heading: var(--font-jetbrains);
  --font-body: var(--font-inter);
  /* enables: bg-bg-primary, text-text-primary, font-heading, etc. */
}
```

Use as: `bg-bg-primary`, `bg-bg-surface`, `border-border`, `text-text-secondary`, `bg-accent`, `font-heading`.

---

## 5. Components

### Buttons — `components/ui/button.tsx:1`

| Variant | Classes |
|---|---|
| `primary` | `bg-accent text-text-on-accent` → hover `bg-accent-hover` + `shadow-accent` |
| `secondary` | `border border-border text-text-primary` → hover `border-accent text-accent` |
| `ghost` | `text-text-secondary` → hover `text-accent bg-bg-surface` |

Sizes: `sm` `px-3 py-1.5`, `md` `px-5 py-2.5`, `lg` `px-8 py-3`. All `rounded-pill`, `font-heading`.

```tsx
import { Button } from "@/components/ui/button";
<Button variant="primary">Hire me</Button>
<Button variant="secondary">View projects</Button>
```

### Cards — `components/ui/card.tsx:1`

```
bg: var(--bg-surface)
border: 1px solid var(--border)
radius: var(--radius-md) → 12px
hover: border → var(--border-strong), bg → var(--bg-surface-hover)
```

```tsx
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
<Card><CardTitle>Project</CardTitle><CardDescription>...</CardDescription></Card>
```

### Badges — `components/ui/badge.tsx:1`

| Variant | Usage |
|---|---|
| `default` | `bg-bg-surface border-border text-text-secondary` |
| `accent` | `bg-accent text-text-on-accent` — primary tag |
| `soft` | `bg-accent-soft text-accent-soft-text` — subtle, contrast-safe in both themes |

### Links

- Default: `text-text-secondary`
- Hover: `text-accent` + underline
- Active nav pill: `text-accent` + `bg-accent/10` + `ring-accent/20` (`components/layouts/nav.tsx:160`)

### Code Blocks

- `bg: var(--bg-surface)`, `font: var(--font-heading)`, keywords in `var(--accent-primary)`, radius `8px`.

### Nav — `components/layouts/nav.tsx:114`

- Floating pill: `bg-bg-surface border-border`
- Active indicator: `motion.span` with `bg-accent/10 ring-accent/20` spring (`stiffness: 380, damping: 32`)
- Theme toggle: `bg-bg-surface border-border`

---

## 6. Global Styles — `app/globals.css:68`

- `html` / `body` → `bg-bg-primary`, `font-body`, antialiased, `transition: background-color 0.2s` (disabled for `prefers-reduced-motion`).
- `color-scheme: dark` on `:root`, `light` on `html.light`.
- Headings `h1-h4` → `font-heading`.
- `*:focus-visible` → `outline: 2px solid var(--accent-primary)`.
- `::selection` → `bg-accent` / `text-on-accent`.
- Scrollbar → `border-strong` thumb, `bg-primary` track.

---

## 7. Accessibility Notes

- `text-primary` on `bg-primary` → ~15:1 (AAA).
- `text-secondary` on `bg-primary` → ~7.5:1 (AA).
- `text-on-accent` on `accent-primary` → ~13:1 (AAA) in dark; verify in light.
- `border` at `#1F1F1F` is intentionally subtle — use `border-strong` for required dividers.

---

## 8. File Map

| File | Role |
|---|---|
| `app/globals.css` | Tokens + Tailwind theme, `color-scheme` + light/dark overrides |
| `app/layout.tsx` | Font loading (`Inter`, `JetBrains_Mono`), `Providers` wrapper, body bg/text |
| `components/layouts/providers.tsx` | `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`) + `ReducedMotionProvider` |
| `components/layouts/nav.tsx` | Pill nav + theme toggle — first consumer |
| `components/ui/button.tsx` | Button variants (uses `--accent-ring` for glow) |
| `components/ui/card.tsx` | Card + subcomponents |
| `components/ui/badge.tsx` | Badge variants (`soft` uses `accent-soft-text`) |

---

## 9. Do / Don't

- **Do** keep green to CTA + active + hover hints.
- **Do** use `font-heading` for nav/logo/titles, `font-body` for paragraphs.
- **Don't** put green backgrounds behind long text blocks.
- **Don't** use mono for body copy.
- **Don't** apply `shadow-accent` to every card — only primary CTA.

---

*Last updated: 2026-08-25. Source: `app/globals.css`, `app/layout.tsx`, `components/ui/*`.*
