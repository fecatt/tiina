/** Positive voltage/current-reference terminal is native pin zero.
 * Current sources and the inline current indicator use their directional arrow.
 * Passive parts have no permanently positive terminal.
 */
const positiveMarker:Record<string,[number,number]>={VM:[-10,4],AMV:[-10,4],V:[10,4],VS:[4,-10],VG:[4,10]};
export function componentPolarity(kind:string,state?:{orientation:number;mirrored:boolean}):string{
 const position=positiveMarker[kind];if(!position)return '';
 const rotation=((state?.orientation??0)&3)*90,mirror=state?.mirrored?-1:1;
 // Anchor follows the physical terminal; inverse transform keeps '+' readable.
 return `<g data-polarity="positive" data-terminal="0" transform="translate(${position[0]} ${position[1]}) scale(${mirror} 1) rotate(${rotation})"><text x="0" y="0" text-anchor="middle" style="fill:${kind==='VS'?'#008080':'#800080'};stroke:none;font:bold 8px Arial">+</text></g>`;
}
