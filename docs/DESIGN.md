# Design guide

The look follows the owner's reference (2026-10-24): a warm cream page, white cards, one orange
colour for actions, green for good news and red for danger. Every colour has **one job**. Pages
never use a hex colour directly; they use the variables in `web/src/styles/global.css`, so light
and dark mode always match.

## Colour roles

| Variable                | Light                | Dark                | Job                                                                      |
| ----------------------- | -------------------- | ------------------- | ------------------------------------------------------------------------ |
| `--color-page`          | cream `#f1eee6`      | `#13110f`           | Page background (with a soft green glow at the top, `--color-page-glow`) |
| `--color-bg`            | warm white `#fffdf9` | `#1c1916`           | Cards, panels, dialogs, inputs, the top bar                              |
| `--color-surface`       | sand `#f6f1e8`       | `#26221d`           | Quiet areas inside a card: test code box, instructions, hover            |
| `--color-text`          | `#1c1917`            | `#f5efe6`           | Normal text and headings                                                 |
| `--color-muted`         | `#6b6257`            | `#b2a797`           | Second-level text: details, hints, dates                                 |
| `--color-border`        | `#e8e0d3`            | `#332d26`           | Card and row borders                                                     |
| `--color-border-strong` | `#d4c8b6`            | `#4a4137`           | Input, button and option borders                                         |
| `--color-primary`       | orange `#c2570c`     | amber `#f59e0b`     | **Action**: the main button, chosen option, chosen choice, active tab    |
| `--gradient-action`     | orange → amber       | amber → light amber | Fill of the main button on a page (one per area, like "Start test")      |
| `--color-accent-text`   | `#ad4a0b`            | `#fbbf6a`           | Links, active tab text, "Room" in the logo, results to open              |
| `--color-accent-soft`   | `#fbead6`            | `#3a2a14`           | Chosen filter chip, soft highlight                                       |
| `--color-success`       | green `#0f7a55`      | `#34d399`           | **Good news**: Open, saved, correct answer, "Open now"                   |
| `--color-progress`      | green                | green               | Progress bars (scores per subject and chapter)                           |
| `--color-danger`        | red `#c62828`        | `#f87171`           | **Danger** text: wrong answer, locked, left the test                     |
| `--color-danger-solid`  | `#c62828`            | `#dc2626`           | Filled danger buttons: Close now, End exam, Unlock                       |
| `--color-warning`       | `#9a5b06`            | `#fbbf24`           | **Wait**: scheduled, opens later, sending                                |
| `--color-paper`         | white                | white               | The test paper itself, so it reads like real paper                       |

Each `…-bg` partner (`--color-success-bg`, `--color-danger-bg`, `--color-warning-bg`) is the soft
background behind that colour's text, for example the green "Open" badge.

## Rules

1. **One orange button per area.** The main thing to do is orange (`Button` primary). Everything
   else is a white secondary button. Red only for actions that end or close something.
2. **Green means good, red means a problem, amber means wait.** Never use them for decoration.
3. **Status words get their colour**: a student's test card says "Open now" in green, "Started"
   and "MCQ result" in orange, "Locked" in red, old tests in grey.
4. **Answers on result pages**: the student's right answer has a green box, a wrong answer a red
   box, and the correct option a green border. During the test the chosen option is orange, and
   nothing shows which option is correct.
5. **Type**: page titles and big status titles use the serif display font (`--font-display`);
   everything else uses the system sans-serif font, so Urdu and English both read well.
6. **Shapes**: cards have 16 px corners and a soft warm shadow in light mode (only a border in dark
   mode); buttons and inputs have 12 px corners and are at least 48 px tall for thumbs.
7. **Dark mode** uses warm dark browns, not pure black, and amber instead of orange, so the same
   roles stay readable.
