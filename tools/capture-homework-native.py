#!/usr/bin/env python3
"""Batch-capture native TINA analyses from downloaded Browser TSC files.

Windows only. UI access is scoped to one selected TINA process/editor and uses
window messages; this script never sends global mouse or keyboard input.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import uuid


WAIT_DIALOG_S = 20.0
WAIT_GRAPH_S = 180.0
POLL_S = 0.1
SW_RESTORE = 9
SW_HIDE = 0
WM_COMMAND = 0x0111
WM_SETTEXT = 0x000C
BM_CLICK = 0x00F5
OPEN_COMMAND = 6
ANALYSIS = {
    "output": (162, "TDCTransferDlg", "native-output"),
    "input": (162, "TDCTransferDlg", "native-input"),
    "input_5V": (162, "TDCTransferDlg", "native-input-5V"),
    "amplifier_ac": (167, "TACTransferDlg", "native-amplifier-ac"),
    "amplifier_transient": (171, "TTranAnalDlg", "native-amplifier-transient"),
}
CASES = (
    ("output", ("output",)),
    ("input", ("input",)),
    ("input_5V", ("input_5V",)),
    ("amplifier", ("amplifier_ac", "amplifier_transient")),
)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_helpers(root: Path):
    """Use only the repository's scoped Win32 enumeration helper."""
    import ctypes
    from ctypes import wintypes as w
    from types import SimpleNamespace
    helper_path = root / 'tools' / 'native-oracle.py'
    spec = importlib.util.spec_from_file_location('homework_native_oracle', helper_path)
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    u=oracle.u
    u.SendMessageW.argtypes=[w.HWND,w.UINT,ctypes.c_size_t,ctypes.c_void_p]
    u.PostMessageW.argtypes=[w.HWND,w.UINT,w.WPARAM,w.LPARAM]
    u.IsWindow.argtypes=[w.HWND]
    u.IsWindowVisible.argtypes=[w.HWND]
    u.IsIconic.argtypes=[w.HWND]
    u.ShowWindow.argtypes=[w.HWND,w.INT]
    u.UpdateWindow.argtypes=[w.HWND]
    u.BringWindowToTop.argtypes=[w.HWND]
    u.SetForegroundWindow.argtypes=[w.HWND]
    u.GetWindowThreadProcessId.argtypes=[w.HWND,ctypes.POINTER(w.DWORD)]
    u.SetWindowPos.argtypes=[w.HWND,w.HWND,w.INT,w.INT,w.INT,w.INT,w.UINT]
    return SimpleNamespace(o=oracle,u=u,w=w,ctypes=ctypes,
        command=lambda h,n:u.PostMessageW(h,WM_COMMAND,n,0))


def owned_windows(session, pid: int) -> list[dict]:
    return session.o.windows(pid)


def wait_editor(session, pid: int, timeout: float = 45.0) -> int:
    end = time.monotonic() + timeout
    last: list[dict] = []
    while time.monotonic() < end:
        last = [w for w in owned_windows(session, pid) if w["class"] == "TSchematicEditor"]
        if len(last) == 1:
            return last[0]["hwnd"]
        if len(last) > 1:
            raise RuntimeError(f"Multiple TSchematicEditor windows in PID {pid}: {last}")
        time.sleep(POLL_S)
    raise TimeoutError(f"No TSchematicEditor appeared in PID {pid}; windows={last}")


def enum_class(session, pid: int, cls: str, *, visible: bool | None = None) -> list[dict]:
    rows = [w for w in owned_windows(session, pid) if w["class"] == cls]
    if visible is not None:
        rows = [w for w in rows if w["visible"] is visible]
    return rows


def restore_and_paint(session, hwnd: int, editor: int | None = None) -> None:
    u = session.u
    if hasattr(session,'pid'):
        for app in enum_class(session,session.pid,'TApplication'):
            if u.IsIconic(app['hwnd']):u.ShowWindow(app['hwnd'],SW_RESTORE)
    if editor is not None and editor != hwnd:
        u.ShowWindow(editor, SW_RESTORE)
        u.UpdateWindow(editor)
    u.ShowWindow(hwnd, SW_RESTORE)
    u.BringWindowToTop(hwnd)
    u.SetForegroundWindow(hwnd)
    u.UpdateWindow(hwnd)


def capture_window(session, hwnd: int, path: Path, editor: int | None = None) -> None:
    from PIL import ImageGrab

    restore_and_paint(session, hwnd, editor)
    path.parent.mkdir(parents=True, exist_ok=True)
    ImageGrab.grab(window=hwnd).save(path)


def set_text(session, hwnd: int, value: str) -> None:
    buf = session.ctypes.create_unicode_buffer(value)
    session.u.SendMessageW(hwnd, WM_SETTEXT, 0, session.ctypes.cast(buf, session.ctypes.c_void_p))


def exact_file_dialog(session, pid: int, timeout: float = WAIT_DIALOG_S) -> int:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        rows = [w for w in owned_windows(session, pid) if w["class"] == "#32770" and w["visible"]]
        if len(rows) > 1:
            raise RuntimeError(f"Multiple native file/dialog windows in PID {pid}: {rows}")
        if rows:
            dlg = rows[0]["hwnd"]
            edits = [c for c in session.o.windows(pid, dlg) if c["class"] == "Edit" and c["control_id"] == 1148]
            if len(edits) != 1:
                raise RuntimeError(f"Expected native file-name Edit control 1148 in dialog {dlg}; found {len(edits)}")
            return dlg
        time.sleep(POLL_S)
    raise TimeoutError(f"No process-owned native file dialog appeared for PID {pid}")


def enter_file_dialog(session, pid: int, path: Path) -> None:
    dlg = exact_file_dialog(session, pid)
    edits = [c for c in session.o.windows(pid, dlg) if c["class"] == "Edit" and c["control_id"] == 1148]
    set_text(session, edits[0]["hwnd"], str(path.resolve()))
    session.u.PostMessageW(dlg, WM_COMMAND, 1, 0)
    end = time.monotonic() + WAIT_DIALOG_S
    while time.monotonic() < end:
        if not session.u.IsWindow(dlg) or not session.u.IsWindowVisible(dlg):
            return
        time.sleep(POLL_S)
    raise TimeoutError(f"Native file dialog {dlg} did not close")


def export_graph_scoped(session, pid: int, graph: int, path: Path) -> None:
    """Run observed graph export command 381 using only this PID's file dialog."""
    session.u.PostMessageW(graph, WM_COMMAND, 381, 0)
    enter_file_dialog(session, pid, path)


def open_file(session, pid: int, editor: int, path: Path) -> None:
    restore_and_paint(session, editor)
    session.command(editor, OPEN_COMMAND)
    enter_file_dialog(session, pid, path)
    time.sleep(0.4)
    # An ERC warning is explicitly allowed; every other modal remains an error.
    for warning in enum_class(session, pid, "TERCForm", visible=True):
        dismiss_erc(session, pid, warning)
    unexpected = [w for w in owned_windows(session, pid)
                  if w["visible"] and w["class"] == "#32770"]
    if unexpected:
        raise RuntimeError(f"Unexpected modal after opening {path.name}: {unexpected}")


def button_control(session, pid: int, parent: int, label: str) -> int:
    rows = [w for w in session.o.windows(pid, parent)
            if w["class"] in ("TBitBtn", "TButton", "Button")
            and w["title"].replace("&", "").startswith(label)]
    if len(rows) != 1:
        raise RuntimeError(f"Expected one {label!r} button in owned window {parent}; found {len(rows)}")
    return rows[0]["hwnd"]


def dismiss_erc(session, pid: int, warning: dict) -> str:
    title = warning["title"]
    button = button_control(session, pid, warning["hwnd"], "Закрыть")
    session.u.SendMessageW(button, BM_CLICK, 0, 0)
    time.sleep(0.15)
    return title


def handle_erc_warnings(session, pid: int, manifest: dict) -> None:
    for warning in enum_class(session, pid, "TERCForm", visible=True):
        title = dismiss_erc(session, pid, warning)
        manifest.setdefault("erc_warnings", []).append(title)


def wait_dialog_class(session, pid: int, expected: str, timeout: float = WAIT_DIALOG_S) -> int:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        handle_erc_warnings(session, pid, session.current_case)
        rows = [w for w in owned_windows(session, pid) if w["class"] == expected and w["visible"]]
        if len(rows) > 1:
            raise RuntimeError(f"Multiple {expected} dialogs in PID {pid}: {rows}")
        if rows:
            return rows[0]["hwnd"]
        other = [w for w in owned_windows(session, pid)
                 if w["visible"] and w["class"] in ("#32770", "TErrorForm", "TMessageForm")]
        if other:
            raise RuntimeError(f"Unexpected modal during analysis (not ERC): {other}")
        time.sleep(POLL_S)
    raise TimeoutError(f"TINA analysis dialog {expected} did not appear")


def hide_old_graphs(session, pid: int) -> None:
    rows = enum_class(session, pid, "TDFWindow")
    for row in rows:
        session.u.ShowWindow(row["hwnd"], SW_HIDE)
        if session.u.IsWindowVisible(row["hwnd"]):
            raise RuntimeError(f"Could not hide previous TDFWindow {row['hwnd']}")


def run_analysis(session, pid: int, editor: int, command: int, dialog_class: str,
                 graph_key: str, paths: dict[str, Path], manifest: dict) -> tuple[int, Path]:
    hide_old_graphs(session, pid)
    restore_and_paint(session, editor)
    session.command(editor, command)
    dlg = wait_dialog_class(session, pid, dialog_class)
    capture_window(session, dlg, paths["dialog"], editor)
    # The persisted TSC already contains ranges and saved DC-control settings.
    # Accept them unchanged; do not alter controls or recreate the schematic.
    ok=button_control(session,pid,dlg,'OK')
    session.u.SendMessageW(ok,BM_CLICK,0,None)
    deadline = time.monotonic() + WAIT_GRAPH_S
    graph: int | None = None
    while time.monotonic() < deadline:
        handle_erc_warnings(session, pid, manifest)
        # Since all previous graphs were hidden, the first visible graph now
        # belongs to this analysis even if TINA reused an old HWND.
        candidates = enum_class(session, pid, "TDFWindow", visible=True)
        if len(candidates) > 1:
            raise RuntimeError(f"Expected one new TDFWindow after {dialog_class}; found {candidates}")
        if candidates:
            graph = candidates[0]["hwnd"]
            break
        unexpected = [w for w in owned_windows(session, pid)
                      if w["visible"] and w["class"] in ("#32770", "TErrorForm", "TMessageForm")]
        if unexpected:
            raise RuntimeError(f"Unexpected modal during {dialog_class}: {unexpected}")
        time.sleep(POLL_S)
    if graph is None:
        raise TimeoutError(f"No new visible TDFWindow appeared after {dialog_class}")

    # Match the observed graph capture size, then paint the actual native window.
    session.u.SetWindowPos(graph, 0, 5, 5, 1200, 800, 0x14)
    capture_window(session, graph, paths["graph"], editor)
    fresh_export = paths["fresh_export"]
    fresh_export.parent.mkdir(parents=True, exist_ok=True)
    export_graph_scoped(session, pid, graph, fresh_export)
    end=time.monotonic()+10
    while time.monotonic()<end and (not fresh_export.is_file() or fresh_export.stat().st_size==0):time.sleep(.05)
    if not fresh_export.is_file() or fresh_export.stat().st_size == 0:
        raise RuntimeError(f"Graph export did not produce data: {fresh_export}")
    final_export = paths["text"]
    final_export.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(fresh_export, final_export)
    # Save only the task-local working copy so a subsequent Open has no prompt.
    session.command(editor, 9)
    time.sleep(0.25)
    manifest.setdefault("analyses", []).append({
        "analysis": graph_key,
        "dialog_class": dialog_class,
        "graph_hwnd": graph,
        "text": str(final_export),
        "text_bytes": final_export.stat().st_size,
        "graph_png": str(paths["graph"]),
        "dialog_png": str(paths["dialog"]),
        "status": "ok",
    })
    return graph, final_export


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_variants(args: argparse.Namespace) -> list[int]:
    raw = [','.join(map(str,range(107)))] if args.all else ([args.variants] if args.variants is not None else [str(args.variant)])
    try:
        values = [int(item.strip()) for item in raw for item in item.split(",") if item.strip()]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Variants must be comma-separated integers") from exc
    if not values or any(v < 0 or v > 106 for v in values):
        raise argparse.ArgumentTypeError("Specify one or more variants from 0 to 106")
    if len(set(values)) != len(values):
        raise argparse.ArgumentTypeError("Duplicate variants are not allowed")
    return values


def paths_for_case(output_root: Path, run_dir: Path, variant: int,
                   model: str, case: str, graph_key: str) -> dict[str, Path]:
    output_dir = output_root / f"variant{variant:02d}" / "TINA"
    graph_dir = output_root / f"variant{variant:02d}" / "graphs"
    graph_label = graph_key.replace("_", "-")
    graph_png = graph_dir / f"native-{graph_label}.png"
    dialog_png = graph_dir / f"native-{graph_label}-analysis.png"
    final_txt = output_dir / f"{model}_{graph_key}.txt" if graph_key.startswith("amplifier_") else output_dir / f"{model}_{case}.txt"
    fresh_export = run_dir / "exports" / f"variant{variant:02d}-{graph_key}.txt"
    return {"graph": graph_png, "dialog": dialog_png, "text": final_txt,
            "fresh_export": fresh_export}


def one_case(session, pid: int, editor: int, output_root: Path,
             run_dir: Path, variant: int, model: str, case: str,
             analyses: tuple[str, ...], run_manifest: dict) -> None:
    source = output_root / f"variant{variant:02d}" / "Browser" / f"{model}_{case}.TSC"
    if not source.is_file():
        raise FileNotFoundError(f"Downloaded Browser TSC not found: {source}")
    source_hash = sha256(source)
    case_dir = run_dir / f"variant{variant:02d}" / case
    case_dir.mkdir(parents=True, exist_ok=False)
    work_copy = case_dir / f"{model}_{case}.TSC"
    shutil.copy2(source, work_copy)
    if sha256(work_copy) != source_hash:
        raise RuntimeError(f"TSC copy hash mismatch for {source}")

    record = {
        "variant": variant, "model": model, "case": case,
        "source": str(source), "source_sha256": source_hash,
        "work_copy": str(work_copy), "status": "running", "analyses": [],
    }
    run_manifest["cases"].append(record)
    session.current_case = record
    open_file(session, pid, editor, work_copy)
    screenshot = output_root / f"variant{variant:02d}" / "graphs" / f"native-{case.replace('_', '-')}-schematic.png"
    session.command(editor,117)
    time.sleep(.15)
    capture_window(session, editor, screenshot)
    record["schematic_png"] = str(screenshot)
    for graph_key in analyses:
        command, dialog_class, _graph_name = ANALYSIS[graph_key]
        paths = paths_for_case(output_root, run_dir, variant, model, case, graph_key)
        run_analysis(session, pid, editor, command, dialog_class, graph_key, paths, record)
    record["status"] = "ok"
    record["work_copy_sha256_after"] = sha256(work_copy)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture saved TINA analyses for one or more downloaded variants.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Capture all 107 previously generated variants")
    group.add_argument("--variant", type=int, help="One variant, for example 3")
    group.add_argument("--variants", help="Comma-separated variants, for example 3,59")
    parser.add_argument("--output-root", default="output", help="Project output root (default: output)")
    parser.add_argument("--pid", type=int, help="Use this already-running TINA PID; only its editor is controlled")
    parser.add_argument("--exe", help="TINA executable to start when --pid is omitted")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    if os.name != "nt":
        raise SystemExit("This capture utility requires Windows.")
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        variants = parse_variants(args)
    except argparse.ArgumentTypeError as exc:
        raise SystemExit(f"error: {exc}") from exc
    root = project_root()
    output_arg = Path(args.output_root)
    output_root = (output_arg if output_arg.is_absolute() else root / output_arg).resolve()
    if args.pid is not None and args.exe:
        raise SystemExit("Use either --pid or --exe, not both.")
    if args.pid is not None and args.pid <= 0:
        raise SystemExit("--pid must be a positive process ID.")
    session = load_helpers(root)
    if args.pid is None:
        local = Path(os.environ.get("LOCALAPPDATA", ""))
        exe = Path(args.exe).expanduser() if args.exe else local / "Programs" / "TinaTI" / "DesignSoft" / "Tina 9 - TI" / "tina.exe"
        exe = exe.resolve()
        if not exe.is_file():
            raise FileNotFoundError(f"TINA executable not found: {exe}; pass --exe or --pid")
        # Keep the instance open after the run. Never search for or kill other TINA processes.
        process = subprocess.Popen([str(exe)], cwd=str(exe.parent))
        pid = int(process.pid)
        exe_used = str(exe)
    else:
        pid = args.pid
        exe_used = None

    editor = wait_editor(session, pid)
    session.pid = pid  # Rebind the observed helper to this explicitly chosen process.
    session.editor = editor
    run_id = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
    run_dir = root / "work" / "homework-native" / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    run_manifest = {
        "run_id": run_id, "started_local": time.strftime("%Y-%m-%d %H:%M:%S"),
        "pid": pid, "editor_hwnd": editor, "exe": exe_used,
        "variants": variants, "output_root": str(output_root), "status": "running", "cases": [],
    }
    manifest_path = run_dir / "manifest.json"
    session.current_case = run_manifest
    try:
        for variant in variants:
            variant_dir = output_root / f"variant{variant:02d}"
            metadata_path = variant_dir / "parameters-results.json"
            metadata=json.loads(metadata_path.read_text(encoding='utf-8')) if metadata_path.is_file() else {}
            models=json.loads((root/'tools/homework/models.json').read_text(encoding='utf-8'))
            model=metadata.get('config',{}).get('model') or models.get(str(variant))
            if not isinstance(model, str) or not model.strip():
                raise ValueError(f"No config.model in {metadata_path}")
            run_manifest.setdefault("models", {})[str(variant)] = model
            for case, analyses in CASES:
                try:
                    one_case(session, pid, editor, output_root, run_dir,
                             variant, model, case, analyses, run_manifest)
                except Exception as exc:
                    if run_manifest["cases"] and run_manifest["cases"][-1].get("status") == "running":
                        run_manifest["cases"][-1]["status"] = "error"
                        run_manifest["cases"][-1]["error"] = f"{type(exc).__name__}: {exc}"
                    raise
                manifest_path.write_text(json.dumps(run_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        run_manifest["status"] = "ok"
        return 0
    except Exception as exc:
        run_manifest["status"] = "error"
        run_manifest["error"] = f"{type(exc).__name__}: {exc}"
        print(f"ERROR: {run_manifest['error']}", file=sys.stderr)
        return 1
    finally:
        run_manifest["finished_local"] = time.strftime("%Y-%m-%d %H:%M:%S")
        manifest_path.write_text(json.dumps(run_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Run manifest: {manifest_path}")


if __name__ == "__main__":
    raise SystemExit(main())
