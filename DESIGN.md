---
name: VillageLab
description: The matchday programme that prints a village's score against its Town Hall ceiling.
colors:
  pitch: "#17713a"
  pitch-2: "#116031"
  chalk: "#f6faf2"
  kit: "#ffd21f"
  ink: "#0d1a11"
  bg: "#f3f6ef"
  panel: "#ffffff"
  panel-2: "#e9efe3"
  panel-3: "#d9e3d1"
  line: "#c6d2bd"
  line-2: "#8a9c80"
  text: "#0d1a11"
  text-2: "#2c3b30"
  muted: "#526257"
  faint: "#64736a"
  gold: "#8a5f00"
  gold-2: "#6b4900"
  elixir: "#a12bb2"
  dark: "#5545cf"
  shiny: "#08708a"
  glowy: "#7b25c0"
  starry: "#a8490a"
  sparky: "#0a62c4"
  ok: "#0f7a41"
  warn: "#8a5800"
  bad: "#bd2a20"
  info: "#1260b6"
typography:
  display:
    fontFamily: "Archivo, 'Arial Narrow', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 6.8vw, 5.5rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0.005em"
    fontVariation: "'wdth' 62"
  scoreline:
    fontFamily: "Archivo, 'Arial Narrow', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(4.5rem, 15vw, 9.5rem)"
    fontWeight: 900
    lineHeight: 0.82
    letterSpacing: "0.005em"
    fontVariation: "'wdth' 62"
  headline:
    fontFamily: "Archivo, 'Arial Narrow', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.4vw, 3.25rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0.005em"
    fontVariation: "'wdth' 62"
  title:
    fontFamily: "Archivo, 'Arial Narrow', ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0.012em"
    fontVariation: "'wdth' 62"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  figure:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 88"
  label:
    fontFamily: "Archivo, 'Arial Narrow', ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.04em"
    fontVariation: "'wdth' 75"
  chip:
    fontFamily: "Archivo, 'Arial Narrow', ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: 1.5
    letterSpacing: "0.05em"
    fontVariation: "'wdth' 75"
rounded:
  none: "0px"
spacing:
  gutter: "20px"
  panel: "16px"
  stack: "16px"
  section: "64px"
  container: "1400px"
components:
  button-primary:
    backgroundColor: "{colors.kit}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "7px 14px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.kit}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "7px 14px"
  button-ghost-hover:
    backgroundColor: "{colors.text}"
    textColor: "{colors.bg}"
  tag-search:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  masthead:
    backgroundColor: "{colors.pitch}"
    textColor: "{colors.chalk}"
    height: "56px"
  nav-link-active:
    backgroundColor: "{colors.kit}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
  nav-link-hover:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
  chip-gold:
    backgroundColor: "{colors.kit}"
    textColor: "{colors.ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.none}"
    padding: "1px 6px"
  section-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "{spacing.panel}"
  fixture-row-hover:
    backgroundColor: "{colors.text}"
    textColor: "{colors.bg}"
  hero-badge:
    backgroundColor: "{colors.kit}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  footer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.chalk}"
---

# Design System: VillageLab

## Overview

**Creative North Star: "The Matchday Programme"**

A village plays its Town Hall ceiling, and every page is a sheet of the programme that prints the score. The reference is a printed football programme and the league almanac behind it: pitch green owning whole regions edge to edge, white stock for the tables, near-black green ink, one kit yellow. Print is flat, so nothing floats and nothing has a shadow. Corners are square everywhere. A section starts under a heavy ink rule and its rows are divided by hairlines; there are no cards.

One typeface does everything. Archivo's width axis sets the condensed, heavy, all-caps headlines and squad numerals (62% width), the button and chip labels (75%), table figures (88%, tabular) and running text (100%). State changes are hard cuts: hover is an instant inversion, nothing eases between states, and the one authored motion (the cover scoreline) arrives digit by digit in steps.

Daylight is the default, because a programme is read in daylight. Dark is the night fixture: the same page under floodlights, with the pitch, chalk, kit yellow and ink unchanged. Game currencies keep their own hues as data colours in both themes. Official game art stands on mown pitch stripes.

**Key Characteristics:**
- Pitch green regions, full bleed, with a 4px chalk touchline at their foot.
- White or pale stock for tables; 3px ink rule above, 1px hairlines between rows.
- Square corners, no shadows, no transitions.
- One face (Archivo variable), width axis carries the hierarchy.
- Kit yellow for the one action and for the accent numeral on green.
- State shown by pattern as well as colour: hatch for what remains, dashes for unowned or caution.

## Colors

A green-and-paper print palette with one loud yellow, plus a fixed set of currency hues that are data, never decoration.

### Primary
- **Pitch Green** (pitch): owns the masthead, the cover, identity bands, and every stage that game art stands on. Theme-invariant.
- **Mow Stripe** (pitch-2): the darker band in the mown stripes and the panel colour inside a pitch region. Theme-invariant.
- **Kit Yellow** (kit): filled primary buttons, the active masthead link, chips and badges marked gold, the selection highlight, and the 3px focus outline. Always paired with ink text. Theme-invariant.

### Secondary
- **Chalk** (chalk): text on pitch, the touchline under the masthead and cover, footer text. Theme-invariant.
- **Accent Gold** (gold): the gold currency and the accent used as text (the first figure of a scoreline, accent links). Dark enough to read on white stock in daylight; brightens at night; becomes kit yellow on pitch.

### Neutral
- **Programme Ink** (ink): text on kit yellow, borders of filled controls, the footer band. Never changes with theme.
- **Stock** (bg): page background. **Panel White** (panel), **Panel Tint** (panel-2), **Panel Shade** (panel-3): section fills, hover fill, unowned slots.
- **Hairline** (line) for row dividers; **Rule Grey-Green** (line-2) for ghost borders, hatch strokes and dashed outlines.
- **Text** (text), **Text Secondary** (text-2), **Muted** (muted), **Faint** (faint): the text ladder. Text doubles as the heavy rule colour.

### Data colours
- **Elixir** (elixir), **Dark Elixir** (dark), **Shiny Ore** (shiny), **Glowy Ore** (glowy), **Starry Ore** (starry), **Sparky Stone** (sparky): each currency's figure is set in its own hue, matching the game badge beside it. Sparky is kept clear of Shiny.
- **Status**: ok, warn, bad, info. Used for progress fills, chips and tone on figures.

### Named Rules
**The Theme-Invariant Four Rule.** Pitch, mow stripe, chalk and kit yellow do not change under the night fixture. A green page is a green page at night.

**The Two Yellows Rule.** Gold is yellow you read (text, the gold currency); kit is yellow you press (fills). Never fill a control with gold, never set body text in kit on white stock.

**The Data Colour Rule.** A currency hue names a currency. Do not use elixir, dark, ore or sparky hues for decoration, headings or status.

**The Pitch Re-point Rule.** Inside a pitch region the neutral and status tokens are re-pointed to chalk-based values, so any component dropped on green is legible without knowing it is there. Do not hand-colour components for the pitch.

## Typography

**Display Font:** Archivo variable (with Arial Narrow, ui-sans-serif fallback)
**Body Font:** Archivo variable (with ui-sans-serif, system-ui, Segoe UI)
**Label/Mono Font:** Archivo at 75% width for labels; the mono stack exists in tokens but is not part of the voice.

**Character:** One face across its width axis, the way a programme sets everything in one family: squad-number headlines at their narrowest and heaviest, labels a notch wider, text at full width.

### Hierarchy
- **Display** (900, clamp(2.75rem, 6.8vw, 5.5rem), 0.95, uppercase, balanced wrap): the cover headline only.
- **Scoreline** (900, clamp(4.5rem, 15vw, 9.5rem), 0.82): the cover score; first figure in accent, a small "v" at 0.34em between the figures.
- **Headline** (900, clamp(2rem, 4.4vw, 3.25rem), 0.95, uppercase): landing section heads. Tool pages use the same face at 40px/56px for page heads and 30px for section heads.
- **Title** (800, 19px panel titles up to 28-36px fixture titles, uppercase, 62% width): section-panel names, report titles, nav links (14-15px).
- **Stat** (900, 44px, line-height 1, tabular): headline figures in a stat line, with a 13px title-voice label over them.
- **Body** (400, 15px default; 17-18px for cover and lead copy; 12-14px for captions): running text at full width, capped near 52-66ch.
- **Figure** (tabular, 88% width): table numbers and costs, so a seven-digit figure fits its cell and columns align.
- **Label** (800, 14px, 0.04em, uppercase, 75% width): buttons; chips and flags drop to 11px at 0.05-0.06em.

### Named Rules
**The One Face Rule.** Everything is Archivo; hierarchy comes from width, weight and case, not from a second family. Tables are set in the text face, not a typewriter.

**The Headline Width Rule.** A figure inside a headline takes the headline's width, not the table's.

## Layout

Content sits in a centered 1400px container with a 20px gutter. Pitch regions (masthead, cover, identity bands) and the footer run full bleed with the container inside them. Sections on the landing are spaced 56-64px apart; panels pad 16px with a 10px by 16px title bar. The cover splits into a text column and a 300-520px art column from the lg breakpoint; below it the art drops out. Editorial sections use asymmetric 5/7 or 7/5 splits, with one lead story spanning two rows against two shorter notes. Fixture lists are full-width rows: 88px art stage (120px from sm), title and copy, button at the far right. Shelves scroll horizontally with snap on narrow screens and become a 4-column grid from 880px. Stat runs flex-wrap at a 190px basis per figure, divided by hairlines.

## Elevation & Depth

Flat. There are no shadows anywhere; depth is carried by the pitch-versus-stock contrast, by the heavy 3px ink rule that opens a section, and by tonal panel fills (panel, panel-2, panel-3). The only pressed effect is a 1px downward nudge on active filled controls, with no transition.

### Named Rules
**The Print Is Flat Rule.** No box-shadow, no blur, no glow. If something needs to separate, give it a rule or a different stock.

## Shapes

Square corners everywhere (0px). Borders are the form language: 2px ink frames on controls and fixture tiles, 3px ink rules above sections and tables, 1px hairlines between rows, a 4px chalk touchline under pitch regions. Pattern carries state alongside colour: 135-degree hatching for what remains (progress tracks, locked hero alcoves, the bad chip), dashed borders for unowned slots and caution, solid for settled. Mown stripes are 90-degree repeating bands (1.75rem on stages, 7rem on identity bands). Glyphs are drawn as inline SVG (star, theme icons), never typed.

## Components

### Buttons
Square, capped, inverted on hover with a hard cut.
- **Shape:** square (0px), 2px border.
- **Primary:** kit fill, ink text and border; label voice; 7px 14px padding (cover lookup button 16px label, 24px horizontal).
- **Hover / Focus:** instant inversion to ink fill, kit text. Focus is the global 3px kit outline at 2px offset. Active nudges down 1px.
- **Ghost:** transparent, text colour, line-2 border; hover fills with text colour and sets the label in the page background colour.
- **Disabled:** 55% opacity, default cursor.

### Chips
- **Style:** 1.5px border in currentColor, 1px 6px padding, 11px label voice.
- **Tones:** plain (text-2 on line-2 border), gold (kit fill, ink), ok and info (coloured outline), warn (dashed outline), bad (outline plus a 22% hatch fill).

### Cards / Containers
- **Section panel:** not a card. White stock with a 3px text-colour rule on top and a 1px hairline at the foot; no side borders. Title bar in the title voice with a hairline under it; 16px body padding.
- **Banner:** 2px border (line-2, warn dashed, or bad) on panel, 14px text-2.
- **Fixture tile / row:** 2px ink frame or ruled row; the whole tile is the link. Hover fills panel-2 (tiles) or inverts the row to text colour (landing fixture list). A flag sits flush at top-left in ink or kit.

### Inputs / Fields
- **Tag search:** one ruled box, 2px ink border on white, holding the field and the primary button joined by a 2px left border. Field set in the figure voice, semibold, tracked. Large (cover, max 460px wide) and compact (tool headers) sizes.
- **Focus:** the 3px kit outline on the whole box.

### Navigation
- **Masthead:** sticky, pitch green, 56px tall, 4px chalk touchline. Wordmark in the headline voice at 21-26px, three section links, theme toggle at right.
- **Links:** title voice, 14-15px, full masthead height. Current section is a solid kit block with ink text; others invert to chalk with ink text on hover. On narrow screens the links scroll with a right-edge mask.
- **Village tabs:** the button family at 13px; selected is primary, others ghost, unavailable ghost at 55%.

### Progress bar
A 10px track with a 1px text-colour frame. Done is a solid fill ending in a 1px rule; what remains is hatched in line-2. Tone by completion: ok at 99%+, kit at 60%+, warn at 30%+, bad below. Count bars use a plain panel-2 track.

### Squad badges and gear slots
Hero levels are kit badges with a 2px ink border in the narrowest heaviest voice (max inverts to ink with kit text, bad is red with white text, locked is dashed and faint). Locked heroes lose their stripes for a diagonal hairline hatch and grey out. Equipment slots are tinted squares with a line-2 border; unowned is dashed and greyed; epic gets a 2px ink rim. A small kit level tag hangs off the bottom-right corner.

### Scoreline (signature)
Two figures with a small "v" between, the first in accent. On the cover the digits arrive one at a time as hard cuts (steps, 0.09s apart); visible by default, and under reduced motion they simply appear.

## Do's and Don'ts

### Do:
- **Do** run pitch green edge to edge and close it with the 4px chalk touchline.
- **Do** open every section and table with a 3px ink rule and divide rows with 1px hairlines.
- **Do** pair kit yellow with ink, and use it for the one action per region.
- **Do** set every figure that is compared down a column in the figure voice (tabular, 88% width).
- **Do** mark state with pattern as well as colour: hatch for remaining, dashes for unowned or caution.
- **Do** change state as an instant inversion; use stepped animation if anything must arrive over time.
- **Do** stand game art on mown pitch stripes.

### Don't:
- **Don't** round a corner.
- **Don't** add a shadow, blur or glow.
- **Don't** add transitions or eased fades between states.
- **Don't** wrap content in floating cards; use the ruled section.
- **Don't** introduce a second typeface; use Archivo's width axis.
- **Don't** use a currency hue for anything but that currency's figures.
- **Don't** fill a control with gold or set text in kit yellow on white stock.
