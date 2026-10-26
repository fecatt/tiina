import catalog from './native-catalog.json';
const glyphs=new Map<string,number>();
for(const group of catalog.groups)for(const entry of group.items){
 const item=entry as {kind?:string;typeId:number;glyphIndex:number};
 glyphs.set(item.kind??'native:'+item.typeId,item.glyphIndex);
}
let nativeImageAvailable=false;
/** Resolve once before the palette is first painted; HTML fallbacks are not images. */
export async function loadNativePalette():Promise<void>{
 try{
  const response=await fetch('/tina/component-icons.png');
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().startsWith('image/'))return;
  const bitmap=await createImageBitmap(await response.blob());bitmap.close();nativeImageAvailable=true;
 }catch{nativeImageAvailable=false;}
}
/** Crop the original image-list cell. Geometry and colors are not redrawn. */
export function nativePaletteIcon(kind:string):string|null{
 if(!nativeImageAvailable)return null;
 const registered=glyphs.get(kind==='diode'?'D':kind);if(registered===undefined)return null;
 // Frame zero is the reserved ellipsis glyph; registry indices start after it.
 const index=registered+1;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${index*29} 0 29 29" style="overflow:hidden" data-native-glyph="${index}" aria-hidden="true" focusable="false"><image href="/tina/component-icons.png" width="6786" height="29"/></svg>`;
}
