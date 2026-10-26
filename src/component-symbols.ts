import type { Component } from './codec.ts';
import {componentPolarity} from './component-polarity.ts';
import {nativeSymbolVector} from './native-symbol-vectors.ts';

export type ComponentSymbolState = Pick<Component, 'orientation' | 'mirrored'> | Component;

/** SVG contents for the semantic v66 symbols supported by the editor. */
export function componentSymbol(kind: string, component?: ComponentSymbolState): string {
 // The small native WMF collapses ground's last bar into a pixel and turns
 // battery plates into heavy rectangles. Preserve the form with clean lines.
 if(['GND','V','L'].includes(kind))return `<g data-native-symbol="${kind}" style="stroke:currentColor;stroke-width:1;stroke-linecap:round;stroke-linejoin:round">${componentBody(kind,component)}${componentPolarity(kind,component)}</g>`;
 // The native VG emblem is generic: a saved sinusoidal generator still uses
 // the same step-shaped glyph. Signal settings do not change that emblem.
 const native=nativeSymbolVector(kind,component);if(native)return native;
 return componentBody(kind,component)+componentPolarity(kind,component);
}
function componentBody(kind: string, component?: ComponentSymbolState): string {
  const line = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${x1},${y1}L${x2},${y2}"/>`;
  if (kind === 'GND') return '<path d="M0,0V8M-8,8H8M-4,12H4M-1.5,16H1.5"/>';
  if (kind === 'CONNECTOR') return '<circle cx="0" cy="0" r="1.5" fill="currentColor"/>';
  if (kind === 'R') return '<path d="M0,0H11M29,0H40"/><rect x="11" y="-4" width="18" height="8"/>';
  if (kind === 'C') return '<path d="M0,0H17M17,-9V9M23,-9V9M23,0H40"/>';
  if (kind === 'L') return `<path d="M0,0H8${'c0,-8 6,-8 6,0'.repeat(4)}H40"/>`;
  if (['D', 'ZENER', 'SCHOTTKY'].includes(kind)) {
    const cathode = kind === 'ZENER' ? 'M22,-12H26V8H30' : kind === 'SCHOTTKY' ? 'M22,-5V-9H26V9H30V5' : 'M26,-8V8';
    return `<path d="M0,0H14M26,0H40M14,-8L26,0L14,8Z${cathode}"/>`;
  }
  if (kind === 'V') return '<path d="M0,0V12M-8,12H8M-5,16H5M-8,20H8M-5,24H5M0,24V40"/>';
  if (kind === 'NPN' || kind === 'PNP') return '<path d="M-16,0H-4M-4,-11V11M-4,-7L16,-18V-24M-4,7L16,18V24"/>' + (kind === 'NPN' ? '<path d="M6,14L13,17L10,10Z" fill="currentColor"/>' : '<path d="M4,10L10,13L8,16Z" fill="currentColor"/>');
  // Native DC source has an axis and an open arrow pointing to terminal zero.
  // In its normal vertical position that arrow points upwards, as in TINA.
  if (kind === 'VS') return '<path d="M0,0H40M18,-3L10,0L18,3"/><circle cx="20" cy="0" r="12"/>';
  if (kind === 'VG') {
    const wave = '<path d="M12,4H16V-4H24V4H28"/>';
    return `<path d="M0,0H6M34,0H40"/><circle cx="20" cy="0" r="14"/><g>${wave}</g>`;
  }
  if (kind === 'I' || kind === 'IS') return '<path d="M0,0H6M34,0H40M27,-6L20,0L27,6M23,-6L16,0L23,6"/><circle cx="20" cy="0" r="14"/>';
  if (kind === 'AM') return '<path d="M0,0H40M24,0L17,-4V4Z"/>';
  if (kind === 'VM' || kind === 'AMV') {
    const text = kind === 'VM' ? 'V' : 'A';
    const rotation = component ? (component.orientation & 3) * 90 : 0;
    const mirror = component?.mirrored ? -1 : 1;
    return `${line(0, 0, 0, 6)}${line(0, 34, 0, 40)}<circle cx="0" cy="20" r="14"/><g transform="translate(0 20) scale(${mirror} 1) rotate(${rotation})"><text x="0" y="5" text-anchor="middle" style="fill:var(--meter-glyph,#000080);stroke:none;font:bold 18px Arial">${text}</text></g>`;
  }
  return '';
}
