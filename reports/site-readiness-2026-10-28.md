# BrowserTransfer readiness inventory

> Первичный исторический срез до исправления проводки и повторного UI-прохода 28.10.2026. Текущий статус находится в [docs/STATUS.md](../docs/STATUS.md); незавершённые действия ниже не являются актуальным планом.

**Scope.** Read-only inspection of `src/native-menus.json`, `src/native-catalog.json`, `src/main.ts`, analysis/solver modules and the corresponding source files in `C:/Users/fedor/Documents/ChatGPT/Tiina/HostedTina`. No full test suite was run. HostedTina is the checked-in mirror; this inventory does not verify a live public deployment.

## What is wired in the local project

- The 9 native menu trees are loaded from `native-menus.json`. `main.ts` maps 52 of 133 leaf command IDs to direct actions. Other leaf rows have no direct ID mapping and are rendered disabled by `menuItem`; that fact alone does **not** establish that no equivalent exists elsewhere. `menus` appends non-native entries such as characteristic-family and h-parameter commands; the graph menu is also context-specific. See `src/main.ts` around the `nativeActions`, `renderMenus`, `action`, and `analysisDialog` definitions.
- The editor has direct paths for common schematic editing, TSC open/save, grid/labels/visibility, and selected analysis flows. Solver configuration types are OP, DC, DC family, AC, and transient (`src/solver.ts`). The h command is an added helper that calls `calculateH`, not a complete reproduction claim for all native analysis commands (`src/main.ts`, `hDialog`). Graph display includes A/B cursor controls and result tables. The `postprocess` control is disabled for AC results.
- The six source palette groups contain 74 entries in total. Fifty-two are marked unsupported and rendered unavailable; 22 entries across the groups use creatable kinds. Active items include common passives, voltage/current sources, meters, diodes, NPN/PNP transistors, and two diode variants. Keys, most semiconductor entries, and all 14 SPICE macro entries in this catalog are unavailable. The catalog metadata itself warns that a catalog record does not prove analysis support and marks digital generators disabled.

## Catalog difference: local vs HostedTina mirror

- `native-catalog.json` and `native-menus.json` are byte-identical in the local project and HostedTina mirror. Their group names/order therefore do not explain the readiness difference.
- The local `src/library.json` is about 1.74 MB and its `bjt_catalog` contains 1,061 NPN plus 554 PNP entries (1,615 catalog entries). HostedTina `src/library.json` is about 12 KB, has no `bjt_catalog`, and contains only three generic records: `BF240`, `!NPN`, and `!PNP`. The catalog UI reads `bjt_catalog` when present and otherwise falls back to `bjt_models` (`src/bjt-library.ts`). A model available in the local tree is therefore not necessarily selectable from the mirrored hosted tree. This compares source files, not a live server response.

## Concrete lab blockers and verification limits

- Work requiring a named BJT model beyond those three records is blocked on the HostedTina mirror unless its deployed library is separately expanded. Local results using the full catalog do not establish hosted parity.
- Labs requiring unsupported MOSFET/JFET/555/op-amp/SPICE macro or digital-source entries cannot be completed from the current component palette as those entries are marked unsupported. The T&M menu only maps the oscilloscope command; other native instrument menu entries have no direct mapping, although some measuring components exist in the palette.
- Native analyses such as temperature, noise, Fourier, and native AC/DC result-table menu commands have no direct menu mapping. Do not infer that all related computation is absent solely from the menu: the browser also has general result tables, waveform plots, and custom analysis routes. AC graph post-processing is explicitly disabled, and transient initial-condition UI is partly disabled; its code notes that those settings are not persisted to TSC.
- Current native input-characteristic verification is still in progress. The reported Planck failure traced to the test UI connecting both VS1 terminals to ground, so it is not evidence that the calculation itself fails. A separate false-success status on calculation errors is being corrected. Treat the input-characteristic path as unverified until the corrected rerun completes.

**Conclusion.** The source supports a useful subset of the TINA workflow, but its menus, palette, model catalog, and analysis paths are intentionally partial. “TINA-ready” should be stated per workflow and per deployment/library snapshot; the source does not support a claim of full TINA compatibility.
