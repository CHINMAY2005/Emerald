---
name: Emerald
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#2b6954'
  on-secondary: '#ffffff'
  secondary-container: '#adedd3'
  on-secondary-container: '#306d58'
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
  secondary-fixed: '#b0f0d6'
  secondary-fixed-dim: '#95d3ba'
  on-secondary-fixed: '#002117'
  on-secondary-fixed-variant: '#0b513d'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display:
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
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
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
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system for Emerald centers on clarity, precision, and a sense of high-value utility. Targeting users in the SaaS and finance sectors, the UI evokes an emotional response of security and systematic efficiency.

The design style is **Corporate Modern with a Minimalist influence**. It prioritizes heavy white space and a rigorous adherence to a functional grid, ensuring that the interface remains unobtrusive while highlighting critical data. Surface treatments are kept clean, avoiding heavy skeuomorphism in favor of subtle tonal shifts and refined borders.

## Colors
The color palette is anchored by the Emerald Primary (#10B981), used strategically for primary actions, success states, and key brand identifiers. 

- **Primary:** Emerald Green is the core of the identity, used for high-emphasis buttons and active navigation states.
- **Secondary:** A deep forest green used for text contrast in headers or dark-mode surfaces to maintain brand continuity.
- **Neutral:** A systematic scale of grays that handle borders, secondary text, and background layers.
- **Semantic:** Standardized red for errors and amber for warnings, balanced to match the luminance of the emerald primary.

## Typography
This design system utilizes **Inter** across all levels to maintain a systematic, utilitarian aesthetic. 

Large display titles use tighter letter spacing and bolder weights to command attention, while body text is optimized for readability with generous line heights. Label styles for buttons and tags use a medium weight to differentiate them from standard body copy. For mobile views, large headlines scale down to prevent excessive word wrapping, ensuring the hierarchy remains intact on smaller viewports.

## Layout & Spacing
The layout follows a **Fluid Grid** model based on an 8px square rhythm. 

- **Desktop:** A 12-column grid with 24px gutters. Page margins are fixed at 40px to provide a breathable frame for content.
- **Tablet:** An 8-column grid with 16px gutters.
- **Mobile:** A 4-column grid with 16px gutters and 16px side margins. 

Internal component spacing (padding/margins) must always be a multiple of the 4px base unit to ensure visual alignment and vertical rhythm.

## Elevation & Depth
Hierarchy in this design system is established through **Tonal Layers** and **Low-Contrast Outlines**. 

Instead of heavy shadows, depth is communicated by shifting the background color of containers (e.g., moving from a white background to a light gray surface). When shadows are necessary for floating elements like modals or dropdowns, use highly diffused, low-opacity (5-10%) neutral tints. Borders are preferred over shadows for card definition, using a 1px solid stroke in a light neutral shade to maintain a crisp, flat aesthetic.

## Shapes
The shape language is **Soft**, utilizing subtle corner rounding to temper the professional tone with a modern, approachable feel. 

Standard components like buttons and input fields use a 0.25rem (4px) radius. Larger containers, such as cards or modals, scale up to 0.5rem (8px) or 0.75rem (12px) for a more pronounced silhouette. This consistent rounding ensures that even data-heavy interfaces feel cohesive and intentional.

## Components
- **Buttons:** Primary buttons use the Emerald Green fill with white text. Secondary buttons use a light gray ghost style or a subtle emerald outline.
- **Chips/Tags:** Used for categorization, these feature a low-opacity emerald background with high-contrast forest green text to ensure legibility.
- **Inputs:** Form fields use a 1px neutral border that transitions to an emerald 2px border on focus. Labels are consistently placed above the field in the `label-md` style.
- **Cards:** Defined by a 1px neutral-200 border and a white background. Padding within cards should follow the `lg` (24px) spacing token.
- **Data Tables:** High-density lists with light gray dividers. The header row should use a subtle gray background to separate it from the data entries.
- **Lists:** Interactive list items should feature a subtle emerald-tinted hover state to provide clear visual feedback.