You are setting the default visual direction for this project. Treat these rules as the baseline design system for the root catalog and future static game screens unless a specific game concept needs a narrowly scoped exception.

## DESIGN GOAL
Create a restrained game archive UI that feels calm, practical, and readable. The repository should look like a disciplined collection of small experiments, not a marketing site and not a generic SaaS dashboard.

## CORE VISUAL CHARACTER
- Quiet, structured, grayscale-first foundation
- Designed for a static game catalog and compact game screens
- Information-led hierarchy through typography, spacing, and alignment
- Sparse accent usage with clear purpose
- Clean, low-noise, and easy to scan on mobile first

## NON-NEGOTIABLE RULES
- Do not build landing-page-style hero sections with dramatic decoration
- Do not rely on bright accent colors across the whole layout
- Do not use heavy shadows, glassmorphism, blur, or glossy effects
- Do not use oversized rounded corners or playful novelty styling by default
- Do not mix unrelated component styles on the same page
- Do not let visual flair compete with game instructions or catalog metadata

## COLOR SYSTEM
Use a grayscale-first palette for layout surfaces and typography.

### Base colors
- Page background: soft off-white or light gray
- Surface / card background: white or near-white
- Primary text: near-black
- Secondary text: muted gray
- Borders and dividers: subtle cool or neutral gray
- High-emphasis controls: charcoal or deep neutral
- Text on dark controls: white or near-white

### Accent usage
- Accent colors must be sparse and functional
- Use accent mainly for links, active states, or lightweight metadata emphasis
- If a game mechanic depends on color, keep gameplay colors local to the mechanic instead of tinting the entire page
- Avoid neon, saturated gradients, and brand-like palette behavior in catalog or shell UI

## TYPOGRAPHY
Use a clean sans-serif system stack. Typography should carry hierarchy before color does.

### Typography rules
- Prefer modest but strong heading sizes
- Keep line-height controlled and readable
- Avoid decorative fonts and excessive tracking
- Keep labels understated
- Make dates, controls, genre, and session metadata easy to scan

## SPACING SYSTEM
Use a consistent spacing rhythm across the repository.

### Spacing rules
- Keep sections clearly grouped without large decorative gaps
- Reuse the same padding logic for related surfaces
- Prefer practical density over sparse showcase spacing
- Maintain steady vertical rhythm on both mobile and desktop

## SURFACES
Cards, panels, and empty states should share one visual language.

### Surface rules
- Flat background
- Subtle visible border
- No heavy shadow
- Medium radius only
- Shared padding rhythm
- Visual separation should come from border, spacing, and layout instead of effects

## LAYOUT
Optimize for portrait mobile first, with desktop expansion that preserves the same information order.

### Layout rules
- Keep primary content left-aligned inside each section
- Use consistent page margins and section spacing
- Favor scan-friendly stacks and grids over dramatic hero compositions
- Make the first screen immediately informative
- Root catalog pages should feel like an archive or index, not a campaign page

## COMPONENT RULES

### 1. Page headers
- Keep headers concise and information-led
- A short label, title, summary, and useful stats are enough
- Avoid oversized banners or purely decorative mastheads

### 2. Cards
- Reuse the shared surface style everywhere
- Keep titles clear and compact
- Place metadata in a consistent row or cluster
- Let the primary action remain obvious without overpowering the card

### 3. Metadata chips
- Use only for genre, controls, session length, state, or similar metadata
- Keep tones muted and readable
- Do not use chips as decoration

### 4. Buttons and links
- Primary action: dark neutral fill with light text
- Secondary action: white background, subtle border, dark text
- Hover and focus states must stay subtle
- Radius should match card/input logic

### 5. Empty states
- Keep them plain, useful, and calm
- Explain the state clearly and suggest the next meaningful expectation
- Do not illustrate empty states with decorative gimmicks

### 6. Game screens
- Gameplay UI may use more contrast when needed for clarity
- Even then, keep the shell UI restrained and readable
- Instructions, restart controls, and score/win-state feedback should remain obvious on first load

## INTERACTION RULES
- Use restrained transitions only where they improve clarity
- Hover states should be subtle
- Focus states should be clearly visible but not flashy
- Avoid dramatic motion or ornamental animation in shell UI

## CONSISTENCY CHECK
Before finishing any page or screen, verify:
- The layout still reads as a calm archive or focused game screen
- The palette is mostly grayscale outside gameplay-specific needs
- Border, radius, spacing, and typography rules are reused consistently
- Primary actions are obvious without dominating the page
- Metadata remains easy to scan
- The page does not drift into landing-page or generic SaaS styling

## IMPLEMENTATION REQUIREMENTS
- Define shared tokens first
- Reuse the same tokens for color, spacing, border, radius, and typography
- Avoid ad hoc per-section styling when a shared rule would work
- Keep the final HTML/CSS easy for another agent to inspect and extend quickly

## FINAL STANDARD
The finished result should feel like a quiet, well-organized daily game archive: flat surfaces, restrained contrast, strong readability, sparse accents, clean metadata, obvious actions, and enough personality to support the games without turning the shell into a marketing page.
