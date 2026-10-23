/** Original SVG artwork for classic circuit-editor toolbar controls.
 * These are interface icons, independent of the editable electrical symbols. */
const svg=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#111" stroke-width="1.45" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">${body}</svg>`;
const meter=(letter:string,extra='')=>`<path d="M16 2V6M16 26V30"/><circle cx="16" cy="16" r="10" fill="#ffff00"/><text x="16" y="20" text-anchor="middle" fill="#111" stroke="none" font-family="Arial,sans-serif" font-size="13" font-weight="bold">${letter}</text>${extra}`;
const arrow=(d:string)=>`<path d="${d}" fill="#111"/>`;

export function componentIcon(kind:string):string {
 let body:string;
 switch(kind){
 case 'GND':body='<path d="M16 3V17M5 18H27M9 23H23M13 28H19" stroke-width="2"/>';break;
 case 'R':body='<path d="M2 16H9M23 16H30"/><rect x="9" y="12" width="14" height="8" fill="#ffff00"/>';break;
 case 'C':body='<path d="M2 16H12M20 16H30M12 5V27M20 5V27" stroke-width="2"/>';break;
 case 'L':body='<path d="M2 20H5C5 7 11 7 11 20C11 7 17 7 17 20C17 7 23 7 23 20H30" stroke-width="2"/>';break;
 case 'V':body='<path d="M16 1V6M16 26V31M5 8H27M10 13H22M5 19H27M10 25H22" stroke-width="2"/><path d="M25 1V6M22.5 3.5H27.5"/>';break;
 case 'VS':body=meter('V','<path d="M24 1V7M21 4H27"/>');break;
 case 'VG':body=meter('','<path d="M8 17C11 7 13 7 16 17C19 27 22 25 25 15"/>');break;
 case 'VM':body=meter('V','<path d="M24 1V7M21 4H27"/>');break;
 case 'AM':body='<path d="M2 16H30M19 16L12 10V22Z" stroke="#008000" fill="none"/>';break;
 case 'AMV':body=meter('A','<path d="M24 1V7M21 4H27"/>');break;
 case 'I':body=meter('','<path d="M16 23V9M12 13L16 9L20 13"/>');break;
 case 'IS':body=meter('IS');break;
 case 'NPN':case 'PNP':body='<g stroke="#008000" stroke-width="1.8"><path d="M2 16H11M11 7V25M11 11L24 4V1M11 21L24 28V31"/>'+(kind==='NPN'?'<path d="M18 22L24 28L17 27Z" fill="#008000"/>':'<path d="M18 23L12 20L16 26Z" fill="#008000"/>')+'</g>';break;
 case 'switch':body='<path d="M1 21H8M24 21H31M9 20L24 10"/><circle cx="8" cy="21" r="2" fill="white"/><circle cx="24" cy="21" r="2" fill="white"/>';break;
 case 'diode':body='<path d="M1 16H10M22 16H31M22 6V26"/><path d="M10 6L22 16L10 26Z" fill="#ffff00"/>';break;
 default:body='<rect x="8" y="8" width="16" height="16" fill="#ffff00"/><path d="M2 16H8M24 16H30"/>';break;
 }
 return svg(body);
}

export function toolbarIcon(action:string):string {
 const key=action.replace(/^analysis:/,'');let body:string;
 switch(key){
 case 'text':body='<text x="16" y="27" text-anchor="middle" font-family="Times New Roman,serif" font-size="30" font-weight="bold" fill="#111" stroke="none">T</text>';break;
 case 'new':body='<path d="M7 2H21L27 8V30H7Z" fill="white"/><path d="M21 2V8H27M11 13H22M11 18H22M11 23H19" stroke="#777"/>';break;
 case 'open':body='<path d="M2 10H12L15 13H30L24 29H2Z" fill="#e4bc16"/><path d="M3 10V6H12L15 10H27V13M2 29L7 16H30" fill="#ffff67"/><path d="M17 4H26M23 1L27 4L23 7" stroke="#008000" stroke-width="2"/>';break;
 case 'save':body='<path d="M4 2H25L29 6V30H3V2Z" fill="#183caa"/><path d="M8 3H23V13H8Z" fill="#d8d8d8"/><path d="M10 19H24V29H10Z" fill="white"/><path d="M19 4V11" stroke="#222" stroke-width="3"/><path d="M13 22H21M13 25H21" stroke="#888"/>';break;
 case 'project':body='<path d="M2 9H12L16 13H30L25 29H2Z" fill="#e4bc16"/><path d="M3 10V5H13L16 9H27V13M3 29L8 16H30" fill="#ffff67"/><rect x="13" y="2" width="12" height="15" fill="white"/><path d="M16 6H22M16 10H22" stroke="#777"/>';break;
 case 'spice':case 'svg':body='<path d="M6 2H22L27 7V30H6Z" fill="white"/><path d="M22 2V7H27"/><path d="M11 13L8 16L11 19M22 13L25 16L22 19M19 11L15 22" stroke="#008000" stroke-width="2"/>';break;
 case 'select':body=arrow('M8 3L8 26L14 20L19 30L24 27L19 18L28 18Z');break;
 case 'wire':body='<path d="M3 27H16V17H27" stroke="#3c0000" stroke-width="2"/><path d="M10 17L23 2L28 7L15 22L8 25Z" fill="#ffff00"/><path d="M10 17L15 22M23 2L28 7M8 25L10 17L15 22Z" fill="#444"/>';break;
 case 'rotate':body='<path d="M6 21A11 11 0 1 1 25 23" stroke-width="2"/><path d="M20 19L25 24L29 17"/><rect x="12" y="11" width="9" height="9" fill="#ffff00"/>';break;
 case 'delete':body='<path d="M4 5L27 28M27 5L4 28" stroke="#b40000" stroke-width="4"/>';break;
 case 'undo':body='<path d="M24 25C32 8 17 4 7 12" stroke="#555" stroke-width="3"/><path d="M7 5L7 14L16 13" stroke="#555" stroke-width="3"/>';break;
 case 'redo':body='<path d="M8 25C0 8 15 4 25 12" stroke="#555" stroke-width="3"/><path d="M25 5L25 14L16 13" stroke="#555" stroke-width="3"/>';break;
 case 'fit':case 'zoom-in':case 'zoom-out':body='<circle cx="13" cy="12" r="9" fill="white"/><path d="M20 19L29 29" stroke-width="5"/><path d="M8 12H18" stroke="#d00000" stroke-width="2"/>'+(key==='zoom-out'?'':'<path d="M13 7V17" stroke="#d00000" stroke-width="2"/>');break;
 case 'properties':case 'panel':body='<rect x="3" y="2" width="26" height="28" fill="white"/><path d="M3 8H29"/><path d="M6 5H9" stroke="#000080" stroke-width="2"/><path d="M7 13H14M7 20H14M7 26H14" stroke="#555"/><path d="M17 12H25V16H17ZM17 19H25V23H17Z" fill="#eee"/>';break;
 case 'run':case 'op':case 'dc':case 'dc-family':case 'ac':case 'transient':body='<path d="M8 4L27 16L8 28Z" fill="#008000"/><path d="M9 6L23 16L9 25Z" fill="#31bf31" stroke="none"/>';break;
 case 'cancel':body='<rect x="7" y="7" width="19" height="19" fill="#c40000"/><path d="M8 8H25V25" stroke="#f55"/>';break;
 case 'help':case 'limits':body='<circle cx="16" cy="16" r="13" fill="#ffff00"/><path d="M11 11C10 4 24 5 22 13C21 17 16 15 16 21" stroke="#000080" stroke-width="3"/><circle cx="16" cy="26" r="1.4" fill="#000080" stroke="none"/>';break;
 case 'grid':body='<path d="M5 2V30M12 2V30M19 2V30M26 2V30M2 5H30M2 12H30M2 19H30M2 26H30" stroke="#777" stroke-width=".8"/>';break;
 case 'pins':body='<path d="M4 9H13M19 9H28M16 6V25" stroke="#008000"/><path d="M11 6L17 12M11 12L17 6M25 6L31 12M25 12L31 6" stroke="#e00000"/>';break;
 case 'validate':body='<path d="M5 16L12 24L28 6" stroke="#008000" stroke-width="4"/>';break;
 default:body='<rect x="5" y="5" width="22" height="22" fill="#eee"/><path d="M10 16H22M16 10V22"/>';break;
 }
 return svg(body);
}
