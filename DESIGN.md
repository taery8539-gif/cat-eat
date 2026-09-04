---
name: Cozy Meadow
colors:
  surface: '#fcfaed'
  surface-dim: '#dcdace'
  surface-bright: '#fcfaed'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f4e7'
  surface-container: '#f0eee1'
  surface-container-high: '#eae9dc'
  surface-container-highest: '#e4e3d6'
  on-surface: '#1b1c15'
  on-surface-variant: '#43493b'
  inverse-surface: '#303129'
  inverse-on-surface: '#f3f1e4'
  outline: '#73796a'
  outline-variant: '#c3c9b7'
  surface-tint: '#416916'
  primary: '#416916'
  on-primary: '#ffffff'
  primary-container: '#8dba5e'
  on-primary-container: '#284900'
  inverse-primary: '#a6d475'
  secondary: '#0c6780'
  on-secondary: '#ffffff'
  secondary-container: '#9ae1ff'
  on-secondary-container: '#09657f'
  tertiary: '#725a39'
  on-tertiary: '#ffffff'
  tertiary-container: '#c5a881'
  on-tertiary-container: '#513d1e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1f18e'
  primary-fixed-dim: '#a6d475'
  on-primary-fixed: '#0e2000'
  on-primary-fixed-variant: '#2c5000'
  secondary-fixed: '#baeaff'
  secondary-fixed-dim: '#89d0ed'
  on-secondary-fixed: '#001f29'
  on-secondary-fixed-variant: '#004d62'
  tertiary-fixed: '#feddb3'
  tertiary-fixed-dim: '#e1c299'
  on-tertiary-fixed: '#281801'
  on-tertiary-fixed-variant: '#584324'
  background: '#fcfaed'
  on-background: '#1b1c15'
  surface-variant: '#e4e3d6'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  speech-bubble:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  container-padding: 24px
  bubble-gap: 16px
---

## Brand & Style

The design system is built on the philosophy of "digital hygge"—creating a space that feels safe, warm, and restorative. Inspired by the gentle pace of life-simulation games, it prioritizes approachability and delight over corporate efficiency.

The visual style is **Tactile & Illustrative**, blending organic shapes with soft textures. It avoids harsh edges and pure blacks, opting instead for hand-drawn qualities, paper-like grain, and subtle "squishy" animations. The emotional goal is to make the user feel like they are stepping into a sun-drenched meadow, greeted by a friendly companion.

Key brand attributes:
- **Nurturing:** Soft, rounded forms that feel safe to touch.
- **Whimsical:** Intentional imperfections like dashed borders and leaf motifs.
- **Organic:** A palette and layout inspired by natural landscapes.

## Colors

The palette is pulled directly from the serenity of a natural glade. It avoids high-saturation "neon" tones in favor of a soft, sun-bleached aesthetic.

- **Primary (Meadow Green):** Used for main actions, leaf motifs, and "Happy" success states.
- **Secondary (Sky Blue):** Used for informational elements, backgrounds, and calm interactions.
- **Tertiary (Warm Wood):** Used for structural elements, heavy borders, and grounding containers.
- **Neutral (Creamy Paper):** The primary surface color, replacing pure white to reduce eye strain and add warmth.
- **Text (Chocolate Earth):** A deep, warm brown used instead of black to maintain the soft aesthetic.
- **Accent (Petal Pink):** Used sparingly for highlights and emotional cues.

## Typography

The typography system uses rounded sans-serifs to maintain a friendly, legible character. **Plus Jakarta Sans** provides the geometric playfulness required for headlines, while **Be Vietnam Pro** offers high readability for body copy and UI labels.

Hierarchy is established through significant weight differences rather than just size. Headlines should feel "plump" and substantial. For speech bubbles and character dialogue, the `speech-bubble` token should be used with increased line height to simulate a comfortable reading pace. Avoid all-caps except for very small, bold labels to keep the tone conversational.

## Layout & Spacing

This design system utilizes a **Fluid Grid** with generous margins to evoke a sense of airiness. The layout should never feel "cramped" or "dense." 

- **Safe Margins:** A minimum of 24px (md) on mobile and 64px (xl) on desktop.
- **Rhythm:** Spacing follows an 8px base unit, but emphasizes the larger gaps (24px+) to create distinct "islands" of content.
- **Reflow:** On mobile, components stack vertically with leaf-shaped dividers between sections. On desktop, content is centered in a maximum 1200px container to maintain the "cozy" proximity.

## Elevation & Depth

Depth is conveyed through **Tonal Layering** and **Soft Shadows**, rather than realistic lighting.

- **The Ground:** The base layer uses a subtle paper-texture grain over the Neutral Cream color.
- **Floating Bubbles:** Cards and containers use a very soft, diffuse shadow (`rgba(93, 64, 55, 0.1)`) with a slight downward offset to suggest they are resting gently on the surface.
- **Interactive Depth:** Buttons use a "thick" bottom border (3px - 4px) in a slightly darker shade of their base color to create a tactile, pressable look. When pressed, the button should shift 2px downward, hiding the bottom border to simulate a physical click.

## Shapes

The shape language is dominated by the "Squircle" and the pill. There are no sharp corners in this design system.

- **Primary Containers:** Use the `rounded-xl` (1.5rem / 24px) setting to create "bubbled" containers.
- **Interactive Elements:** Buttons and tags use `rounded-pill` (full radius) for a soft, pebble-like feel.
- **Dashed Outlines:** Secondary containers should use a 2px dashed border in the Wood tone to suggest a "hand-stitched" or "cut-paper" aesthetic.
- **Leaf Accents:** Decorative elements and selection indicators should use an asymmetrical leaf shape (pointed at one end, rounded at the other).

## Components

### Buttons & Inputs
- **Primary Action:** Large, pill-shaped, Meadow Green background with a 4px bottom shadow/border. Text is white or deep brown.
- **Secondary Action:** Cream background with a dashed Wood-tone border.
- **Input Fields:** Soft cream backgrounds with an inner shadow to look "recessed" into the paper surface.

### Speech Bubbles
- **Dialogue:** Large rounded rectangles with a small triangular "tail" pointing to the character. Use the `speech-bubble` typography and a dashed border.

### Cheese Cat (Character States)
- **Neutral/Happy:** Displayed in the corner or center during positive interactions. Use a gentle "bounce" animation.
- **Hungry/Sad:** Eyes slightly narrowed or drooping. Used when feeding status is low. Provide a "Feed" button that triggers a heart-particle effect.
- **State Transition:** Use a "poof" cloud of smoke (white/grey circles) when the cat changes states or appears/disappears.

### Chips & Tags
- Small pill shapes using the Sky Blue or Petal Pink palette. Often accompanied by a small icon (a fruit, a leaf, or a bell).

### Cards
- Bubbled containers with a subtle paper texture. Headers are separated by a dashed line. Use leaf motifs as "bullet points" in lists.