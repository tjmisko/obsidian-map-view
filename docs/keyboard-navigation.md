# Keyboard Navigation

The Main Map View can be driven almost entirely from the keyboard. When the map
is focused (click it, or run the **"Focus map (Normal mode)"** command) it is in
**Normal mode**, and the following keys are available.

Enable this with the **"Modal map interaction (vim-like)"** setting (on by
default).

## Pan & zoom

| Key                                          | Action                               |
| -------------------------------------------- | ------------------------------------ |
| Arrow keys / `h` `j` `k` `l`                 | Pan (hold `Shift` for a larger step) |
| `+` / `=`                                    | Zoom in                              |
| `-`                                          | Zoom out                             |
| `Alt`/`Option` (or `Cmd`/`Ctrl`) + `+` / `-` | Zoom by the **big** step             |
| Mouse wheel                                  | Pan                                  |
| `Ctrl`/`Cmd` + wheel                         | Zoom                                 |

The normal and big zoom steps are configurable in settings (**Zoom step** and
**Big zoom step**).

## Commands

In Normal mode, the **capital** first letters (i.e. `Shift` + the letter) open
keyboard-navigable modals:

| Key       | Opens                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Shift+F` | **Filters** — edit the query/filter live                                                                                           |
| `Shift+V` | **View** — a numbered list of view options (map source, mode, marker labels, follow, fit, reset). Press the number to run/cycle it |
| `Shift+L` | **Layers** — a fuzzy list of layers; press `1`–`9` (or Enter) to toggle a layer. Stays open so you can flip several                |
| `Shift+P` | **Presets** — a fuzzy list of presets; press a number or Enter to apply one                                                        |
| `Shift+E` | **Edit** — on-map editing tools (drawing mode, target note, heading, tags)                                                         |
| `Shift+M` | **Menu** — show/hide the top-left controls panel                                                                                   |

The lowercase keys keep their vim meanings and don't conflict:

| Key | Action                             |
| --- | ---------------------------------- |
| `f` | Fit the map to the visible markers |
| `e` | Toggle drawing (edit) mode         |
| `/` | Focus the query box                |

## In the fuzzy modals (Layers / Presets)

- **Type** to filter the list by name.
- **`1`–`9`** select/toggle the corresponding visible row (digits are always
  shortcuts, never filter text).
- **Arrow keys** move the highlight; **Enter** chooses the highlighted row.
- **Escape** closes the modal.

## Escape

`Escape` walks back through the interaction layers, in order: blur a focused
input → exit drawing mode → close an open popup → (finally) leave the map.
