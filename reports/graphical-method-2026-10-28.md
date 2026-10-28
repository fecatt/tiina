# Graphical transistor workflow

The graph toolbar supports real-valued curve expressions through **Добавить больше кривых…**. Expressions accept arithmetic, parentheses, `x`, and a result-vector name inserted from the available list. For example, `0.35/x` produces a power boundary. A named vector is sampled at each x by linear interpolation; it is not treated as a constant. Existing families remain visible. Axis limits are adjusted through the existing X/Y axis dialogs. Complex AC expression evaluation remains disabled.

The BJT construction is a shared data-driven operation for a measured output family plus a separate 5 V input characteristic. It produces three quadrants, a load-line/transfer construction, a/A/b projections and four sinusoidal construction signals. The 5% tangent criterion used to select the symmetric interval is stated explicitly; it is not a universal distortion specification. Stage estimates and unavailable inputs are shown separately.

Both ordinary results and BJT constructions export native TINA `.TDR` diagrams. Circuit saving remains `.TSC`. Each TDR curve owns an independent XY buffer. Native metadata names include their NUL terminator; scalar offsets follow the complete counted name. Long native text-box annotations are omitted pending reliable layout support; axis labels and point letters remain.

Validation on 28 October 2026: focused expression/record tests, production build, actual browser loading and DC simulation of a saved TSC, adding a power curve, setting a 30 mA axis and downloading TDR. The actual downloaded 12-curve TDR was opened and numerically re-exported in TINA 9.3.150; relative coordinate error was below 3e-15. Six BJT export cases (two devices, three diagrams each) were also opened and numerically re-exported. This proves the checked graph export path; it does not establish general equality between ngspice and every TINA analysis.

DC source sweeps now update both native start-value fields. Native capture waits for the export writer to close and verifies expected sample counts before copying, preventing incomplete stepped-family files from being mistaken for finished results.
