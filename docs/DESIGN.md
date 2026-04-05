# Design System Specification: Neon Studio Hybrid

## 1. Overview & Creative North Star: "The Kinetic Darkroom"
This design system is a high-performance environment designed for focus, precision, and energy. We move away from the "flat web" by adopting **The Kinetic Darkroom** philosophy: the interface should feel like a high-end physical studio—dark, dampened, and expensive—where the only light sources are the data and the interactive elements themselves.

To break the "template" look, we utilize **intentional asymmetry**. Primary actions and metrics are oversized and aggressive, while secondary navigation is tucked into deep charcoal voids. We do not use "boxes"; we use "pools of light" and "layered depths."

---

## 2. Colors & The Physics of Light
The palette is rooted in a deep, near-black charcoal to ensure the Neon Primary can "vibrate" against the background.

### The Palette (Material Design 3 Logic)
- **Primary (`#00FF66`)**: "The Laser." Reserved for active states, primary CTAs, and critical metrics.
- **Secondary (`#FF3366`)**: "The Warning." Used for destructive actions or critical system alerts.
- **Surface & Background**:
    - **Background (`#0A0A0C`)**: The base void.
    - **Surface (`#141519`)**: The primary workspace layer.
    - **Surface Container Highest (`#353437`)**: Used for the most elevated interactive cards.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for layout sectioning. Separation between the main content and the **persistent right-hand sidebar** must be achieved via a transition from `surface` to `surface_container_lowest`. Use the **Ghost Border fallback** (`outline_variant` at 10% opacity) only when content density is so high that tonal shifts fail.

### The Glass & Gradient Rule
Floating elements, such as the **Compact Overlay Window**, must use Glassmorphism.
- **Fill**: `surface_variant` at 60% opacity.
- **Backdrop Blur**: 12px to 20px.
- **Edge**: A top-down linear gradient border (Primary at 20% to Transparent).

---

## 3. Typography: Technical Precision vs. Humanist Flow
We use a high-contrast pairing to distinguish between "Machine Data" and "User Content."

- **Space Grotesk (The Metric)**: Used for `display`, `headline`, and `label` roles. Its monolinear, geometric construction feels like a digital readout. Use `-0.02em` tracking for headlines to give them a "tight," editorial feel.
- **Manrope (The Narrative)**: Used for `title` and `body`. Its humanist curves provide the necessary legibility for long-form data or descriptions, softening the "aggressive" nature of the system.

**Editorial Hierarchy Example:**
- **Display Large**: `spaceGrotesk`, 3.5rem, 500 weight (The Hero Metric).
- **Body Medium**: `manrope`, 0.875rem, 400 weight (The Context).

---

## 4. Elevation & Depth: Tonal Layering
Depth in this system is not a shadow; it is a **Light Leak**.

- **The Layering Principle**: 
    - **Base**: `background` (#0A0A0C).
    - **Persistent Sidebar**: `surface_container_low`.
    - **Active Cards**: `surface_container_high` with a 16px (`lg`) radius.
- **Ambient Shadows**: Shadows are forbidden on standard cards. For floating overlays, use a `primary` tinted shadow: `box-shadow: 0 20px 40px rgba(0, 255, 102, 0.08)`.
- **The Neon Glow**: Active states (focused inputs, toggled buttons) must utilize an outer glow: `box-shadow: 0 0 15px rgba(0, 255, 102, 0.4)`.

---

## 5. Components

### The Persistent Right-Hand Sidebar
The sidebar should not "sit" on the background; it should feel like a slide-out panel from a machine.
- **Background**: `surface_container_low`.
- **Interaction**: Items use a "Left-Border Glow" on hover—a 2px wide `primary` line that fades into the background.

### The Compact Overlay Window
Designed for quick actions or tool settings.
- **Radius**: `xl` (1.5rem) to signify its "temporary" nature compared to the `lg` (1rem) radius of structural elements.
- **Styling**: Glassmorphism (see Section 2) with a 1px `outline_variant` at 20%.

### Buttons
- **Primary**: Solid `primary_container` (#00FF66). Text is `on_primary` (Deep Green). On hover, add a 10px neon glow.
- **Secondary**: Ghost style. `outline` color for text, no fill. On hover, background becomes `primary` at 10% opacity.
- **Tertiary**: Text-only, `spaceGrotesk` in `label-md` for a technical, utility feel.

### Input Fields
- **Idle**: `surface_container_highest` fill, no border.
- **Active**: 1px `primary` border with a subtle 5px glow. Text transitions from `on_surface_variant` to `on_surface`.

### Cards & Lists
- **Spacing**: Use vertical white space (32px or 48px) instead of dividers.
- **Grouping**: Use a subtle `surface_container_lowest` background for the entire group rather than individual card borders.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use `primary_container` gradients for high-impact CTAs to create "soul."
- **Do** allow content to bleed off-edge in the sidebar to emphasize the "studio" feel.
- **Do** use `spaceGrotesk` for all numbers/integers regardless of their size.

### Don’t:
- **Don’t** use 100% white (#FFFFFF). Use `on_surface` (#e5e1e4) to prevent visual fatigue in dark mode.
- **Don’t** use standard drop shadows. If it doesn't look like a neon light or a physical layer shift, delete it.
- **Don’t** use dividers. If you need a divider, you’ve failed to use space or tonal shifts effectively.