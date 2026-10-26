import {component,newComponent,type Component} from './codec.ts';
import {componentSymbol} from './component-symbols.ts';

// Physical native extents in the symbol's post-orientation coordinate space.
const bounds:Record<string,[number,number,number,number]>={
 GND:[-12,-3,24,22],R:[-3,-9,46,18],C:[-3,-13,46,26],L:[-3,-13,46,26],
 D:[-3,-15,46,30],ZENER:[-3,-15,46,30],SCHOTTKY:[-3,-15,46,30],
 V:[-15,-7,30,54],VM:[-18,-7,36,54],AMV:[-18,-7,36,54],VS:[-18,-7,36,54],VG:[-18,-7,36,54],
 I:[-7,-18,54,36],IS:[-7,-18,54,36],AM:[-3,-8,46,16],NPN:[-21,-29,42,58],PNP:[-21,-29,42,58]
};
const cache=new Map<string,string|null>();

/** Render the palette thumbnail from the same native body as a placed symbol. */
export function componentPaletteIcon(kind:string):string|null {
 if(cache.has(kind))return cache.get(kind)!;
 const extent=bounds[kind];if(!extent){cache.set(kind,null);return null;}
 try{
  const native=component(newComponent(kind,0,0,`${kind}1`),0) as Component;
  let body=componentSymbol(kind,native);if(!body){cache.set(kind,null);return null;}
  // Match the palette's yellow native bodies without redrawing their geometry.
  body=body.replace(/<rect(?![^>]*\bfill=)/g,'<rect fill="#ffff00"');
  const [x,y,width,height]=extent,scale=28/Math.max(width,height),cx=x+width/2,cy=y+height/2;
  const rotation=-90*(native.orientation&3),mirror=native.mirrored?-1:1;
  const transform=`translate(16 16) scale(${scale}) translate(${-cx} ${-cy}) rotate(${rotation}) scale(${mirror} 1)`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#111" stroke-width="${1.5/scale}" stroke-linecap="square" stroke-linejoin="miter" color="#111" style="--meter-glyph:#111" aria-hidden="true" focusable="false"><g transform="${transform}">${body}</g></svg>`;
  cache.set(kind,svg);return svg;
 }catch{cache.set(kind,null);return null;}
}
