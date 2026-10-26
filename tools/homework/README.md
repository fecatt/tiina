# Common-emitter homework batch runner

Run from the project root with Node 24 and the editor running at `http://127.0.0.1:5173/`:

```powershell
node --experimental-strip-types tools/run-homework-variants.mjs --list
node --experimental-strip-types tools/run-homework-variants.mjs --variant 3 --dry-run
node --experimental-strip-types tools/run-homework-variants.mjs --variant 3
node --experimental-strip-types tools/run-homework-variants.mjs --variant 59 --dry-run
node --experimental-strip-types tools/run-homework-variants.mjs --variants 3,59 --dry-run
node --experimental-strip-types tools/run-homework-variants.mjs --all --dry-run
```

`HOMEWORK_URL` can select another local editor URL. Playwright is loaded from the bundled desktop runtime; `PLAYWRIGHT_MODULE` can override the absolute module directory for other installations. The simulations use the project's ngspice WASM dependency.

`models.json` maps all 107 homework variants to model names. `variants.json` contains two reviewed design profiles, 3 and 59. The other 105 profiles are intentionally absent: their supply voltage, maximum sweep/current, target resistor values, and manufacturer limits need to be verified before running them. `--all` reports every missing profile and stops before creating any circuit. No paid model API is used.

Additional profiles may be supplied as an object keyed by variant number:

```powershell
node --experimental-strip-types tools/run-homework-variants.mjs --config path/to/reviewed-profiles.json --variants 3,4,5
```

Each profile follows `variants.json`. Use `autoDesign: true` to compute the divider from that model's local h parameters, round resistors to E24 and tune both capacitors along E6 values until the AC loss at 50 Hz is at most 2.5 dB below the passband peak. `Rk`, `Re`, supply and sweep limits are profile data, not generic assumptions about every transistor. Profile 59 preserves its existing selected nominal values when executed.

`layout.json` supplies the shared output, input and amplifier geometry. The input circuit is reused at 5 V and for the collector-voltage family. The UI module creates every component, selects the installed catalog model, enters the parameters, connects every wire, runs the analyses, and downloads genuine TSC files using the editor's Save As command. It never builds or encodes a TSC. The codec is used to read downloaded TSC and the solver is used for numerical design and verification. No native TINA UI automation is used.

Outputs go to `output/variantNN/Browser` (four TSC and numerical/plot exports), `graphs`, `design-calculations.json`, `capacitor-tuning.json`, `parameters-results.json`, and `summary.md`. Errors are captured separately under `work/homework-errors`. Existing outputs for the requested variant are replaced; other variants are untouched. The script requires the local model catalog and does not publish it.

Variant 3 was executed through the complete shared UI path. `--variant 59` and the 107-entry manifest were checked with dry runs; 59 and all 107 were not rerun in this task. Native TINA equivalence is not asserted. The h parameters describe the catalog model near the design target, not every physical transistor. The resistor corner checks are two directional 5% cases, not a complete production tolerance analysis.


# Native TINA capture — phase 2

`capture-homework-native.py` replays the saved analyses in downloaded Browser
TSC files. It does not rebuild or reconfigure the schematics. It copies each
input TSC into a unique `work/homework-native/<run>/.../case.TSC` path before
opening it, so native TINA saves cannot alter the downloaded originals.

Run one variant, starting one TINA instance and leaving it open afterward:

```powershell
py tools/capture-homework-native.py --variant 3
```

Run several variants in one already-running, explicitly selected TINA process:

```powershell
py tools/capture-homework-native.py --variants 3,59 --pid <TINA-PID> --output-root output
```

The source files are read from `output/variantNN/Browser/`; the results are
written under each variant's `TINA/` and `graphs/` directories. The manifest
with source hashes, per-case status, warnings, and errors is kept in the
task-local `work/homework-native/<run>/` folder. The script controls only the
selected PID and its unique `TSchematicEditor`; it does not send global mouse
input or close TINA processes. Any modal other than an ERC warning stops the
batch and is recorded in the manifest.

First-run validation should use one requested variant and a user-selected TINA
PID. Do not start the 100-variant batch until that review succeeds.


## One command for both stages

```powershell
node --experimental-strip-types tools/run-homework-variants.mjs --variant 3 --capture-native --native-pid 4808
```

Replace the PID with the TINA instance you intend to use, or omit
`--native-pid` to start one dedicated instance. The Windows-only native stage
runs after browser downloads and accepts the analyses already saved in TSC;
it does not reconstruct the circuit or enter each component again. For a
reviewed batch use `--variants 3,59 --capture-native`: one TINA process handles
the whole list. The full list is 107 variants numbered 0 through 106. Other
105 model profiles still require checked manufacturer limits before `--all`
will run. `TINA_PYTHON_BIN` may select a Python installation with Pillow.
