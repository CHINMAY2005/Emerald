---
name: VoltShare Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#555f6f'
  on-secondary: '#ffffff'
  secondary-container: '#d6e0f3'
  on-secondary-container: '#596373'
  tertiary: '#a43a3a'
  on-tertiary: '#ffffff'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d9e3f6'
  secondary-fixed-dim: '#bdc7d9'
  on-secondary-fixed: '#121c2a'
  on-secondary-fixed-variant: '#3d4756'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 48px
---

## Brand & Style

This design system embodies a **Modern Eco-Tech** aesthetic, positioning the product as a sophisticated yet accessible peer-to-peer utility. The brand personality is efficient, sustainable, and transparent, aimed at tech-savvy electric vehicle owners and hosts who value seamless peer-to-peer interactions.

The visual direction follows **Minimalism** with a focus on "Eco-Utility." By utilizing heavy whitespace and a restricted, high-contrast palette, the UI directs focus toward functionality—finding and booking chargers—while maintaining a premium feel. The aesthetic avoids typical "green" clichés in favor of a crisp, digital-first execution that feels reliable and high-performance.

## Colors

The palette is optimized for clarity and a sense of "clean energy." 

- **Primary (Emerald):** Used exclusively for high-priority actions, active states, and successful connections. It represents energy flow and system health.
- **Secondary (Graphite):** Provides the structural weight. Used for typography and iconography to ensure high legibility and a grounded, professional feel.
- **Neutral (Slate White):** The foundation of the UI. A very light slate tint (#F8FAFC) is used for backgrounds to reduce eye strain compared to pure white, while maintaining a fresh, airy atmosphere.
- **Functional Accents:** Subtle slate grays are used for borders and disabled states to maintain the minimal hierarchy.

## Typography

The design system utilizes **Inter** for all roles to achieve a systematic, utilitarian look. The typeface is chosen for its exceptional legibility on mobile screens and its neutral, modern tone.

- **Headlines:** Use a tighter letter-spacing and semi-bold weights to create a strong visual anchor.
- **Body:** Standardized on 16px for optimal readability in dense data environments (like charger specs).
- **Labels:** Small labels and captions use a slightly increased letter-spacing and medium weight to ensure they remain distinct from body text even at small sizes.

## Layout & Spacing

The design system employs a **Fluid Grid** model with high internal padding to maintain a "breathable" interface. 

- **Grid:** A 12-column grid for desktop and a 4-column grid for mobile.
- **Rhythm:** An 8px linear scale (with a 4px step for micro-adjustments) governs all margins and paddings.
- **Scannability:** Elements are grouped using generous vertical rhythm (the `lg` spacing token) to separate distinct sections like "Charger Location" from "Pricing Details."

## Elevation & Depth

To maintain the minimal aesthetic, depth is communicated through **Ambient Shadows** and **Tonal Layering** rather than heavy borders.

- **Surfaces:** Cards and floating containers use a pure white background to pop against the Slate White (#F8FAFC) page background.
- **Shadows:** Use extra-diffused, low-opacity shadows (e.g., `box-shadow: 0 4px 20px rgba(31, 41, 55, 0.08)`). Shadows should feel like a soft glow rather than a hard drop.
- **Interactive Depth:** On hover or active state, the shadow should slightly expand or deepen to provide tactile feedback, mimicking a physical lift.

## Shapes

The shape language is defined by **12px rounded corners** (the `rounded-lg` level in this system), which softens the technical nature of the app and makes it feel approachable and modern.

- **Standard Elements:** Buttons, Input Fields, and Small Cards use 12px corners.
- **Container Elements:** Large modal sheets or section containers use the `rounded-xl` (24px) setting for a more modern, mobile-app-centric feel.
- **Icons:** Use a consistent 1.5px or 2px stroke weight with rounded caps to match the UI's geometry.

## Components

- **Buttons:** Primary buttons use a solid Emerald (#10B981) background with white text. Secondary buttons use a Slate White background with a subtle border. Padding is generous (16px x 24px) to ensure a large hit area.
- **Input Fields:** Use a subtle 1px border in a light slate gray. On focus, the border transitions to Emerald with a soft outer glow.
- **Cards:** The primary vehicle for charger listings. Cards must have 12px rounded corners, a pure white background, and the ambient shadow defined in the Elevation section.
- **Chips/Status Tags:** Used for "Available," "In Use," or "Fast Charge." These use low-opacity versions of the Emerald color for backgrounds with high-contrast text.
- **Progress Indicators:** "Charging" states should use a pulse animation on Emerald-colored elements to indicate active energy flow.
- **Checkboxes & Radios:** When selected, these components should be filled with Emerald, using a white check/dot for high contrast.