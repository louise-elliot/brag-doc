# Confidence Journal — Design Guidelines

## Design Philosophy

Confidence Journal is a safe space for reflection and growth. The design should feel like a trusted coach: warm, supportive, professional, and empowering. We avoid corporate coldness and intimidating tech aesthetics in favor of something approachable and human-centered.

**Core principles:**
- **Warm & welcoming** — Colors and typography that feel supportive, not sterile
- **Confident clarity** — Clean layouts that reflect the confidence we're helping users build
- **Editorial quality** — Generous whitespace and thoughtful typography that honors the writing process
- **Calm focus** — No overwhelming colors or busy patterns; this is a reflective space

---

## Color System

### Primary Palette

Our primary color is a warm terracotta that feels energizing without being aggressive — confident and grounded.

```css
--color-primary-50: #fdf4f0;
--color-primary-100: #fae8df;
--color-primary-200: #f4cdb9;
--color-primary-300: #eeab8c;
--color-primary-400: #e6825f;
--color-primary-500: #d96440;  /* Primary brand color */
--color-primary-600: #c24e2f;
--color-primary-700: #a03d27;
--color-primary-800: #843526;
--color-primary-900: #6e2f23;
```

**Usage:**
- `--color-primary-500` — Primary CTAs, active states, key moments
- `--color-primary-600` — Hover states on primary actions
- `--color-primary-100` — Subtle backgrounds, highlights
- `--color-primary-50` — Very light backgrounds for featured content

### Neutral Palette

Warm neutrals that feel inviting rather than cold gray. These form the foundation of the interface.

```css
--color-neutral-0: #ffffff;     /* True white for canvas */
--color-neutral-50: #fafaf9;    /* Subtle off-white */
--color-neutral-100: #f5f5f4;   /* Light backgrounds */
--color-neutral-200: #e7e5e4;   /* Borders, dividers */
--color-neutral-300: #d6d3d1;   /* Subtle borders */
--color-neutral-400: #a8a29e;   /* Placeholder text */
--color-neutral-500: #78716c;   /* Secondary text */
--color-neutral-600: #57534e;   /* Body text */
--color-neutral-700: #44403c;   /* Emphasized text */
--color-neutral-800: #292524;   /* Headings */
--color-neutral-900: #1c1917;   /* Maximum contrast */
```

**Usage:**
- `--color-neutral-0` — Main canvas background
- `--color-neutral-800` — Headings, important labels
- `--color-neutral-600` — Body text, journal entries
- `--color-neutral-500` — Secondary/supporting text
- `--color-neutral-100` — Card backgrounds, subtle containers

### Category/Label Colors

Distinct colors for categorizing wins. These are softer and more muted than the primary to avoid visual competition.

```css
/* Leadership */
--color-category-leadership: #7c3aed;
--color-category-leadership-light: #f3e8ff;

/* Technical Delivery */
--color-category-technical: #0891b2;
--color-category-technical-light: #ecfeff;

/* Collaboration */
--color-category-collaboration: #db2777;
--color-category-collaboration-light: #fdf2f8;

/* Growth */
--color-category-growth: #16a34a;
--color-category-growth-light: #f0fdf4;

/* General/Uncategorized */
--color-category-general: #f59e0b;
--color-category-general-light: #fffbeb;
```

### Semantic Colors

```css
/* Success */
--color-success-500: #16a34a;
--color-success-50: #f0fdf4;

/* Warning */
--color-warning-500: #f59e0b;
--color-warning-50: #fffbeb;

/* Error */
--color-error-500: #dc2626;
--color-error-50: #fef2f2;

/* Info */
--color-info-500: #3b82f6;
--color-info-50: #eff6ff;
```

---

## Typography

### Font Families

We pair a warm, confident serif for display/headings with a clean neo-grotesque sans for body text.

```css
/* Display & Headings — warm, editorial, confident */
--font-display: 'Fraunces', 'Georgia', serif;

/* Body & UI — clean, readable, professional */
--font-body: 'Inter', 'Helvetica Neue', 'Arial', sans-serif;

/* Code & Technical (if needed) */
--font-mono: 'JetBrains Mono', 'Consolas', monospace;
```

**Font loading:**
```css
/* Add to src/styles/fonts.css */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,300;1,9..144,400&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

### Type Scale

A balanced scale that feels spacious and editorial.

```css
--text-xs: 0.75rem;      /* 12px — small labels, captions */
--text-sm: 0.875rem;     /* 14px — secondary text, metadata */
--text-base: 1rem;       /* 16px — body text */
--text-lg: 1.125rem;     /* 18px — emphasized body */
--text-xl: 1.25rem;      /* 20px — subheadings */
--text-2xl: 1.5rem;      /* 24px — section headings */
--text-3xl: 1.875rem;    /* 30px — page titles */
--text-4xl: 2.25rem;     /* 36px — hero headings */
--text-5xl: 3rem;        /* 48px — large display */
```

### Text Styles

```css
/* Display/Headings use Fraunces */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1.2;
  color: var(--color-neutral-800);
}

/* Body text uses Inter */
body, p, li, span {
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.6;
  color: var(--color-neutral-600);
}

/* Journal entries — slightly larger, more spacious */
.journal-entry {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  line-height: 1.75;
  color: var(--color-neutral-700);
}
```

### Weight Guidelines

- **300** — Light, use sparingly for large display text
- **400** — Regular, default for body text
- **500** — Medium, for subtle emphasis and labels
- **600** — Semibold, for headings and important UI elements
- **700** — Bold, for strong emphasis (use sparingly)

---

## Spacing System

Based on a 4px base unit for consistency and rhythm.

```css
--spacing-0: 0;
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-5: 1.25rem;   /* 20px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
--spacing-20: 5rem;     /* 80px */
--spacing-24: 6rem;     /* 96px */
```

**Common patterns:**
- **Component padding:** `--spacing-4` to `--spacing-6`
- **Section spacing:** `--spacing-12` to `--spacing-16`
- **Page margins:** `--spacing-8` to `--spacing-12`
- **Tight spacing (labels, pills):** `--spacing-2` to `--spacing-3`

---

## Border Radius

Soft, friendly corners that feel approachable.

```css
--radius-sm: 0.25rem;   /* 4px — tight, subtle */
--radius-md: 0.5rem;    /* 8px — default for cards, buttons */
--radius-lg: 0.75rem;   /* 12px — larger cards, modals */
--radius-xl: 1rem;      /* 16px — feature cards */
--radius-full: 9999px;  /* Fully rounded — pills, avatars */
```

---

## Shadows

Subtle, warm shadows that add depth without harshness.

```css
--shadow-sm: 0 1px 2px 0 rgba(28, 25, 23, 0.05);
--shadow-md: 0 4px 6px -1px rgba(28, 25, 23, 0.08), 
             0 2px 4px -2px rgba(28, 25, 23, 0.04);
--shadow-lg: 0 10px 15px -3px rgba(28, 25, 23, 0.08), 
             0 4px 6px -4px rgba(28, 25, 23, 0.04);
--shadow-xl: 0 20px 25px -5px rgba(28, 25, 23, 0.08), 
             0 8px 10px -6px rgba(28, 25, 23, 0.04);
```

---

## Component Patterns

### Buttons

**Primary Button:**
- Background: `--color-primary-500`
- Text: white
- Padding: `--spacing-3` `--spacing-6`
- Border radius: `--radius-md`
- Font: `--font-body`, weight 600
- Hover: `--color-primary-600`
- Focus: Ring in `--color-primary-300`

**Secondary Button:**
- Background: transparent
- Text: `--color-neutral-700`
- Border: 1px solid `--color-neutral-300`
- Padding: `--spacing-3` `--spacing-6`
- Border radius: `--radius-md`
- Font: `--font-body`, weight 500
- Hover: `--color-neutral-100` background

**Ghost Button:**
- Background: transparent
- Text: `--color-neutral-600`
- No border
- Padding: `--spacing-3` `--spacing-4`
- Hover: `--color-neutral-100` background

### Cards

Journal entry cards and content containers:
- Background: `--color-neutral-0` (white)
- Border: 1px solid `--color-neutral-200`
- Border radius: `--radius-lg`
- Padding: `--spacing-6`
- Shadow: `--shadow-sm` (default), `--shadow-md` (hover)
- Transition: smooth shadow change on hover

### Input Fields

- Background: `--color-neutral-0`
- Border: 1px solid `--color-neutral-300`
- Border radius: `--radius-md`
- Padding: `--spacing-3` `--spacing-4`
- Font: `--font-body`, `--text-base`
- Focus: Border `--color-primary-500`, ring in `--color-primary-100`
- Placeholder: `--color-neutral-400`

**Textarea (Journal Entry):**
- Larger padding: `--spacing-4` `--spacing-5`
- Min-height: 120px
- Font size: `--text-lg`
- Line height: 1.75
- Background: `--color-neutral-50` when empty, white when focused

### Category Pills/Tags

- Small, rounded pills with category colors
- Background: `--color-category-*-light`
- Text: darker version of category color
- Padding: `--spacing-1` `--spacing-3`
- Border radius: `--radius-full`
- Font: `--font-body`, `--text-sm`, weight 500

### AI Coach Messages

When the AI rewrites entries:
- Container: subtle background `--color-primary-50`
- Border-left: 3px solid `--color-primary-500`
- Padding: `--spacing-5`
- Border radius: `--radius-md`
- Icon: position at top-left
- Font: `--font-body`, `--text-base`
- Heading: "Reframed:" in `--color-primary-700`, weight 600

---

## Layout Principles

### Page Structure

**Desktop:**
- Max width: 1200px
- Content max width: 800px (for reading comfort)
- Side margins: `--spacing-12` minimum
- Vertical spacing between sections: `--spacing-16`

**Mobile:**
- Side margins: `--spacing-4` to `--spacing-6`
- Vertical spacing: `--spacing-8` to `--spacing-12`

### Grid & Columns

Use asymmetric editorial-style layouts where appropriate:
- **2-column layout** for settings pages: 1fr 2fr (sidebar + main)
- **Journal list**: Single column, generous spacing between entries
- **Dashboard**: 12-column CSS grid for flexible tile layouts

### Whitespace Philosophy

Be generous with whitespace. This is a reflective tool, not a dense dashboard.
- **Between journal entries:** `--spacing-8` minimum
- **Around headings:** `--spacing-10` to `--spacing-12`
- **Within cards:** `--spacing-6` to `--spacing-8`
- **Page top margin:** `--spacing-12` to `--spacing-16`

---

## Interaction & Motion

Keep animations subtle and purposeful — they should enhance, not distract.

### Transitions

```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

**Use cases:**
- Button hover/focus: `--transition-fast`
- Card hover: `--transition-base`
- Modal/drawer open: `--transition-slow`

### Hover States

- **Cards:** Lift slightly with shadow increase (`--shadow-sm` → `--shadow-md`)
- **Buttons:** Darken background, scale very slightly (1.02)
- **Links:** Underline with `--color-primary-500`

---

## Voice & Tone in UI Copy

The UI copy should mirror the app's coaching philosophy:

- **Encouraging, not pushy:** "Ready to log a win?" not "You must log daily!"
- **Clear and confident:** "Export accomplishments" not "Maybe export if you want?"
- **Warm, not clinical:** "Your wins this month" not "Performance metrics"
- **Supportive:** "No wins logged yet — that's okay, they'll be here when you're ready"

---

## Accessibility

- **Color contrast:** All text meets WCAG AA (4.5:1 for body, 3:1 for large text)
- **Focus states:** Always visible with ring/outline
- **Touch targets:** Minimum 44x44px for interactive elements
- **Screen readers:** Semantic HTML, proper ARIA labels
- **Keyboard navigation:** Full support for tab, enter, escape

---

## Export Document Styling

When generating the accomplishments export:
- Font: `--font-body` (Inter) for professional readability
- Headings: `--font-display` (Fraunces) for editorial polish
- Generous line height: 1.75 for body text
- Clean hierarchy with clear section breaks
- Subtle color: `--color-neutral-700` for text, `--color-primary-600` for headings
- Professional margins and spacing

---

## Implementation Notes

1. **Set up theme tokens in `/src/styles/theme.css`** using the CSS custom properties defined above
2. **Load fonts in `/src/styles/fonts.css`** (Fraunces and Inter)
3. **Use Tailwind v4** with the custom properties — avoid hardcoded colors
4. **Component library:** Build reusable components (Button, Card, Input, Tag, etc.) that enforce these patterns
5. **Responsive breakpoints:** Mobile-first, with breakpoints at 640px, 768px, 1024px, 1280px

---

## Questions or Customization

If you want to adjust:
- **Warmer/cooler palette:** Shift the primary from terracotta toward blush pink or sage green
- **More/less contrast:** Adjust neutral scale darkness
- **Bolder typography:** Swap Fraunces for a stronger serif like Tiempos or Freight
- **Tighter spacing:** Reduce spacing scale multiplier

This system is designed to grow with you. Start here, then refine based on how it feels in practice.
