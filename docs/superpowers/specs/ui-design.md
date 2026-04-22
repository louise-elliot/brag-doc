# Confidence Journal -- UI Design Spec

## Aesthetic Direction

"Editorial Power" -- high-end editorial magazine meets confident tech tool. Dark, warm, textured. The app should feel like it believes in you more than you believe in yourself.

## Typography

Three-font system:

- **Display**: Fraunces (variable serif, italic for prompts) -- bold, distinctive, editorial weight
- **Body**: Outfit (geometric sans) -- clean, modern, doesn't compete
- **Mono**: IBM Plex Mono -- labels, tags, metadata, tech identity

### Scale

| Element | Font | Size | Weight | Style |
|---------|------|------|--------|-------|
| Prompt text | Fraunces | 38px | 600 | italic |
| Wordmark | Fraunces | 20px | 700 | normal |
| Brag doc group label | Fraunces | 16px | 600 | normal |
| Body text | Outfit | 15px | 400 | normal |
| Entry text | Outfit | 14px | 400 | normal |
| Buttons (primary) | Outfit | 14px | 600 | normal |
| Buttons (secondary) | Outfit | 13px | 500 | normal |
| Section labels | IBM Plex Mono | 10-11px | 600 | uppercase, tracked |
| Tags | IBM Plex Mono | 11px | 500 | normal |
| Dates | IBM Plex Mono | 11px | 400 | normal |
| Entry count badge | IBM Plex Mono | 11px | 400 | normal |

## Color Palette

### Base

| Token | Value | Usage |
|-------|-------|-------|
| `--color-base` | #07080C | Page background |
| `--color-surface` | #0F1117 | Cards, inputs, raised areas |
| `--color-surface-raised` | #161820 | Secondary buttons, hover states |
| `--color-border` | #1E2028 | Input borders, card borders |
| `--color-border-subtle` | #15161D | Dividers, timeline line |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--color-text-primary` | #F0ECE4 | Headings, reframed text, primary content (warm ivory) |
| `--color-text-secondary` | #8B8693 | Body text, entry text, descriptions |
| `--color-text-tertiary` | #55515E | Dates, labels, placeholders, muted UI |

### Accent

| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | #D4863C | Primary accent (burnt amber) |
| `--color-accent-hover` | #E09A52 | Button hover |
| `--color-accent-muted` | rgba(212,134,60,0.12) | Tag backgrounds, subtle fills |
| `--color-accent-border` | rgba(212,134,60,0.25) | Reframe card border, accent borders |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--color-positive` | #4CAF82 | Save confirmation, success states |
| `--color-positive-muted` | rgba(76,175,130,0.12) | Copied button background |
| `--color-danger` | #CF4444 | Destructive actions |
| `--color-danger-muted` | rgba(207,68,68,0.12) | Danger backgrounds |

### Tag Colors (per-category)

Each tag has a unique color to visually distinguish different kinds of work:

| Tag | Color | Muted BG |
|-----|-------|----------|
| leadership | #D4863C | rgba(212,134,60,0.12) |
| technical | #6B8AE0 | rgba(107,138,224,0.12) |
| collaboration | #4CAF82 | rgba(76,175,130,0.12) |
| problem-solving | #C978D6 | rgba(201,120,214,0.12) |
| communication | #E0C46B | rgba(224,196,107,0.12) |
| mentoring | #E07272 | rgba(224,114,114,0.12) |

Tags use a `data-tag` attribute to map to their color. Selected tags show their color as text with muted background and tinted border. Unselected tags are neutral gray.

## Texture and Atmosphere

- **Grain overlay**: SVG fractal noise at 7% opacity, fixed position, covers entire viewport. Adds editorial materiality.
- **Ambient glow**: Large radial gradient (900x900px) in top-right, amber at 7% center fading to transparent. Provides subtle warmth without being distracting.

Both effects are applied via `body::before` and `body::after` pseudo-elements with `pointer-events: none`.

## Spacing and Layout

- Max content width: 760px, centered
- Page padding: 40px horizontal
- Prompt section: 48px top padding, 40px bottom
- Section gaps: 48px between major sections (prompt to entries)
- Card padding: 24-28px internal
- Border radius: 6px (buttons), 10px (inputs/cards), 14px (feature cards)

## Component Specifications

### Header

Wordmark "Confidence" in Fraunces with a 3px amber vertical bar to the left. Date in mono on the right. Settings is reached via the Settings tab in the nav.

### Prompt Section

The prompt is the hero element. Fraunces italic at 38px with a vertical gradient bar (amber to transparent) on the left edge. Max-width 580px so it doesn't stretch across the full width on wider screens. The prompt label ("Today's prompt") sits above in uppercase mono.

### Entry Form

- Textarea: surface background, border, 130px min-height, italic placeholder "Claim your win..."
- Tags: pill-shaped, mono font, color-coded when selected (see tag colors above)
- Save button: amber background, dark text

### Save Interaction (Ceremony)

The save moment has deliberate ceremony:

1. Button flashes green, text changes to "Saved", amber glow pulse animation
2. Textarea border briefly turns green
3. "Win logged" toast appears with checkmark icon (mono font, green)
4. After 800ms, textarea clears and reframe card slides in
5. Toast disappears after 2 seconds

### Reframe Card

- Top accent bar: gradient from amber to transparent
- Top bar with "AI Reframe" label and "side-by-side" indicator
- Two-column layout separated by a vertical gradient divider (amber to subtle)
- Left column: "Your version" label (muted), original text in secondary color
- Right column: "Reframed" label (amber), reframed text in primary color, rendered in an editable textarea with a dashed amber border so the user can tweak the wording before accepting
- Accept and Dismiss buttons at bottom; Accept persists the textarea's current value
- Card enters with a slide-up animation (translateY 16px to 0, 0.5s cubic-bezier)
- Card exits with a slide-up fade (translateY to -8px, opacity to 0)

### Entry List (Timeline)

Past entries are rendered as a timeline rather than flat cards:

- Left vertical line (1px, border-subtle color) connecting entries
- Small dot (7px) on the left edge of each entry, positioned on the timeline
- Most recent entry dot is amber; older entries are neutral gray
- Last entry has no connecting line below
- Entry shows: date (mono), tags (color-coded pills), text, optional "show reframed" toggle
- Reframed text appears with left amber border and fadeIn animation
- Section header shows "Past Entries" with an entry count badge

### Brag Doc Tab

- Controls row: date range dropdown (mono font, custom chevron) + Generate button
- Output is wrapped in a "document preview" card with a floating label ("Generated Brag Doc") that breaks the top border
- Group labels use Fraunces serif at 16px (the only place besides the prompt that uses display font in the body)
- Bullets have hollow amber dots (border only, not filled)
- Footer with "Copy to clipboard" button; on click, changes to "Copied" with green styling for 2 seconds

### Settings Tab

- Wrapped in a card with header, description ("Your journal entries are stored locally..."), and danger button
- Confirmation dialog slides in with fadeIn animation inside the card
- Less barren than v1 due to the card wrapper and privacy messaging

## Animation Specifications

### Page Load

Staggered fadeInUp with cubic-bezier(0.16, 1, 0.3, 1) easing:

| Element | Delay |
|---------|-------|
| Header | 0ms |
| Nav tabs | 60ms |
| Prompt section | 120ms |
| Entry form | 180ms |
| Past entries header | 240ms |
| Past entries list | 300ms |

### Micro-interactions

- Save button: `saveFlash` keyframe (box-shadow pulse), 0.6s
- Save toast: `saveCheck` keyframe (scale bounce), 0.3s
- Reframe card reveal: `reframeReveal` keyframe, 0.5s cubic-bezier
- Reframe card dismiss: opacity + translateY transition, 0.25s
- Reframed text expand: `fadeIn`, 0.25s
- Copy button state change: class toggle with 2s timeout
- Tab switches: instant (no animation needed for content swap)

## Design Reference

The working interactive prototype is at `design/preview-v2.html`. Open in browser to see all tabs, save ceremony, reframe card animation, and tag color coding.
