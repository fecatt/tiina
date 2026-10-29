import type { Curve } from "./solver.ts";
import { scopeWindow } from "./oscilloscope.ts";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmt = (n: number): string => (Number.isFinite(n) ? n.toPrecision(6) : "—");

// TINA-UI: window=oscilloscope; status=partial; full-parity-checks=0 (полная приёмка не подтверждена).
// Осталось: Часть прибора перенесена; полный native-сценарий Run/Stop/Single и каналы не принят. Реестр и правила проверки: docs/UI_WINDOWS.md.
export function showScope(dialog: HTMLDialogElement, curve: Curve): void {
  const oldStyle=dialog.getAttribute('style');
  dialog.addEventListener('close',()=>{if(oldStyle===null)dialog.removeAttribute('style');else dialog.setAttribute('style',oldStyle);dialog.removeAttribute('data-scope');},{once:true});
  const names = curve.names;
  const values = curve.values;
  const vnames = names.slice(1).filter((n) => n.startsWith('v('));
  const timeOf = (i: number): number => {
    const t = values[i][0];
    return typeof t === "number" ? t : (t as [number, number])[0];
  };
  const totalDuration =
    Array.isArray(values) && values.length > 0
      ? Math.max(0, timeOf(values.length - 1) - timeOf(0))
      : 0;
  const total = totalDuration > 0 ? totalDuration : 1;
  const tpd = total / 10;

  const getVal = (i: number, col: number): number => {
    const v = values[i][col];
    return typeof v === "number" ? v : (v as [number, number])[0];
  };
  const autoScale = (vname: string): number => {
    const col = names.indexOf(vname);
    if (col < 1 || values.length === 0) return 1;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < values.length; i++) {
      const v = getVal(i, col);
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 1;
    const span = max - min;
    const perDiv = (span > 0 ? span : 1) / 6;
    return perDiv > 0 ? perDiv : 1;
  };
  const center=(name:string)=>{const col=names.indexOf(name);let lo=Infinity,hi=-Infinity;for(let i=0;i<values.length;i++){const v=getVal(i,col);lo=Math.min(lo,v);hi=Math.max(hi,v);}return Number.isFinite(lo)&&Number.isFinite(hi)?(lo+hi)/2:0;};
  const initialChA = vnames[0] ?? "";
  const initialVB = vnames.length > 1 ? autoScale(vnames[0]) : autoScale(vnames[0] ?? "");
  const initialVA = autoScale(initialChA);

  dialog.textContent = "";
  dialog.setAttribute("data-scope", "1");
  dialog.style.maxWidth = "1100px";
  dialog.style.width = "95vw";
  dialog.style.background = "#1e1e1e";
  dialog.style.color = "#ddd";
  dialog.style.border = "1px solid #444";
  dialog.style.borderRadius = "6px";
  dialog.style.padding = "0";

  const head = document.createElement("div");
  head.style.cssText = "padding:8px 12px;border-bottom:1px solid #444;font:600 13px system-ui,sans-serif;";

  const h = document.createElement("div");
  h.textContent = "Осциллограф — просмотр рассчитанного переходного процесса";
  head.appendChild(h);
  dialog.appendChild(head);

  const body = document.createElement("div");
  body.style.cssText = "padding:10px 12px;max-height:70vh;overflow:auto;";
  dialog.appendChild(body);

  if (vnames.length === 0) {
    const err = document.createElement("p");
    err.style.cssText = "color:#f88;font:13px system-ui,sans-serif;";
    err.textContent = "Нет доступных напряжений v(...) для отображения.";
    body.appendChild(err);
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Закрыть";
    close.style.cssText = "margin-top:10px;padding:4px 12px;cursor:pointer;";
    close.addEventListener("click", () => dialog.close());
    body.appendChild(close);
    if(!dialog.open)dialog.showModal();
    return;
  }

  const opt = (val: string, label: string): string =>
    `<option value="${esc(val)}">${esc(label)}</option>`;
  const vecOpts = vnames.map((n) => opt(n, n)).join("");

  const ctrl = document.createElement("div");
  ctrl.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px 12px;font:12px system-ui,sans-serif;margin-bottom:8px;";
  ctrl.innerHTML = `
    <label>Канал A: <select id="scope-chA" style="width:90px">${vecOpts}</select></label>
    <label>Канал B: <select id="scope-chB"><option value="">—</option>${vecOpts}</select></label>
    <label>Сек/дел: <input id="scope-tpd" type="number" step="any" value="${fmt(tpd)}" style="width:90px"></label>
    <label>A В/дел: <input id="scope-vA" type="number" step="any" value="${fmt(initialVA)}" style="width:80px"></label>
    <label>B В/дел: <input id="scope-vB" type="number" step="any" value="${fmt(initialVB)}" style="width:80px"></label>
    <label>A смещ.: <input id="scope-oA" type="number" step="any" value="${center(initialChA)}" style="width:80px"></label>
    <label>B смещ.: <input id="scope-oB" type="number" step="any" value="0" style="width:80px"></label>
    <label>Режим: <select id="scope-mode"><option value="auto">auto</option><option value="normal">normal</option></select></label>
    <label>Триггер: <select id="scope-tsrc"><option value="A">A</option><option value="B">B</option></select></label>
    <label>Уровень: <input id="scope-tlvl" type="number" step="any" value="0" style="width:80px"></label>
    <label>Фронт: <select id="scope-slope"><option value="rising">rising</option><option value="falling">falling</option></select></label>
    <label>После: <input id="scope-after" type="number" step="any" value="${fmt(timeOf(0))}" style="width:80px"></label>
    <label>Предыст.: <input id="scope-pre" type="number" step="any" value="0.2" style="width:80px"></label>`;
  body.appendChild(ctrl);

  const msg = document.createElement("div");
  msg.style.cssText = "color:#f88;font:12px system-ui,sans-serif;min-height:14px;margin-bottom:6px;";
  body.appendChild(msg);

  const plot = document.createElement("div");
  plot.style.cssText = "background:#0b0b0b;border:1px solid #333;border-radius:4px;";
  body.appendChild(plot);

  const foot = document.createElement("div");
  foot.style.cssText = "padding:8px 12px;border-top:1px solid #444;display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#1e1e1e;";
  const mkBtn = (t: string, id: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = t;
    b.style.cssText = "padding:4px 14px;cursor:pointer;";
    return b;
  };
  const btnDraw = mkBtn("Нарисовать", "scope-draw");
  const btnExp = mkBtn("Экспорт SVG", "scope-export");
  const btnClose = mkBtn("Закрыть", "scope-close");
  foot.append(btnDraw, btnExp, btnClose);
  dialog.appendChild(foot);

  const $ = <T extends HTMLElement>(id: string): T => {
    const el = dialog.querySelector(`#scope-${id}`) as T | null;
    if (!el) throw new Error(`missing scope-${id}`);
    return el;
  };

  let lastSvg = "";
  const draw = (): void => {
    msg.textContent = "";
    const chA = $<HTMLSelectElement>("chA").value;
    const chBval = $<HTMLSelectElement>("chB").value;
    const tpdV = Number($<HTMLInputElement>("tpd").value);
    const vA = Number($<HTMLInputElement>("vA").value);
    const vB = Number($<HTMLInputElement>("vB").value);
    const oA = Number($<HTMLInputElement>("oA").value);
    const oB = Number($<HTMLInputElement>("oB").value);
    const mode = $<HTMLSelectElement>("mode").value as "auto" | "normal";
    const tsrc = $<HTMLSelectElement>("tsrc").value;
    const tlvl = Number($<HTMLInputElement>("tlvl").value);
    const slope = $<HTMLSelectElement>("slope").value as "rising" | "falling";
    const after = Number($<HTMLInputElement>("after").value);
    const pre = Number($<HTMLInputElement>("pre").value);
    if (!(tpdV > 0)) { msg.textContent = "Сек/дел должно быть положительным."; return; }
    if (!(vA > 0) || !(vB > 0)) { msg.textContent = "Масштаб В/дел должен быть положительным."; return; }
    const channels = chBval ? [chA, chBval] : [chA];
    let res: ReturnType<typeof scopeWindow>;
    try {
      res = scopeWindow(curve, {
        channels,
        timePerDivision: tpdV,
        divisions: 10,
        mode,
        triggerSource: tsrc==='B'?(chBval||chA):chA,
        triggerLevel: tlvl,
        slope,
        triggerAfter: Number.isFinite(after) ? after : timeOf(0),
        pretrigger: Number.isFinite(pre) ? pre : 0,
      });
    } catch (e) {
      msg.textContent = e instanceof Error ? e.message : String(e);
      return;
    }
    const W = 1000, H = 500, L = 60, R = 20, T = 20, B = 40;
    const pw = W - L - R, ph = H - T - B;
    const tSpan = Math.max(1e-12, res.stop - res.start);
    const x = (t: number): number => L + ((t - res.start) / tSpan) * pw;
    const chColors = ["#ffe14d", "#7dff7d"];
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="display:block;background:#0b0b0b">`;
    svg += `<rect width="${W}" height="${H}" fill="#0b0b0b"/>`;
    for (let i = 0; i <= 10; i++) {
      const xx = L + (i / 10) * pw;
      svg += `<line x1="${xx}" y1="${T}" x2="${xx}" y2="${T + ph}" stroke="#2a2a2a" stroke-width="1"/>`;
      const tv = res.start + (i / 10) * tSpan;
      svg += `<text x="${xx}" y="${H - 16}" fill="#888" font-size="11" text-anchor="middle">${esc(tv.toPrecision(4))}</text>`;
    }
    for (let j = 0; j <= 8; j++) {
      const yy = T + (j / 8) * ph;
      svg += `<line x1="${L}" y1="${yy}" x2="${L + pw}" y2="${yy}" stroke="#2a2a2a" stroke-width="1"/>`;
    }
    svg += `<text x="${L + pw / 2}" y="${H - 2}" fill="#aaa" font-size="11" text-anchor="middle">t, с</text>`;
    res.channels.forEach((ch, idx) => {
      const color = chColors[idx % chColors.length];
      const scale = idx === 0 ? vA : vB;
      const off = idx === 0 ? oA : oB;
      const mid = T + ph / 2;
      const pts = ch.points.map(([t, v]) => `${x(t).toFixed(2)},${(mid - (v - off) / scale * (ph / 8)).toFixed(2)}`);
      if (pts.length > 0) svg += `<polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts.join(" ")}"/>`;
      svg += `<text x="${L + 6}" y="${T + 14 + idx * 16}" fill="${color}" font-size="12" font-family="monospace">${esc(ch.name)} ${esc(String(scale))} В/дел</text>`;
    });
    svg += `</svg>`;
    lastSvg = svg;
    plot.innerHTML = svg;
  };

  const exportSvg = (): void => {
    if (!lastSvg) return;
    const blob = new Blob([lastSvg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scope.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  for(const channel of ['A','B'])$<HTMLSelectElement>('ch'+channel).onchange=()=>{const name=$<HTMLSelectElement>('ch'+channel).value;if(name){$<HTMLInputElement>('v'+channel).value=String(autoScale(name));$<HTMLInputElement>('o'+channel).value=String(center(name));}draw();};
  btnDraw.addEventListener("click", draw);
  btnExp.addEventListener("click", exportSvg);
  btnClose.addEventListener("click", () => dialog.close());

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  }
  draw();
}