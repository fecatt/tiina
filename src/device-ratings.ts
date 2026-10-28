/** Verified manufacturer limits are data, separate from generic SPICE model fields. */
export type BjtDeviceRating={uceMax_V:number;icMax_A:number;pCollectorMax_W:number;manufacturer:string;source:string};
const ratings:Record<string,BjtDeviceRating>={
 '2N2925':{uceMax_V:25,icMax_A:.1,pCollectorMax_W:.36,manufacturer:'GE/RCA, File 2051, 25 °C',source:'https://www.westfloridacomponents.com/mm5/graphics/datasheets/2/2N2925-GE-SolidState.pdf'},
 BF240:{uceMax_V:40,icMax_A:.05,pCollectorMax_W:.35,manufacturer:'Fairchild, Rev. A, 2003, 25 °C',source:'https://www.komponenten.es.aau.dk/fileadmin/komponenten/Data_Sheet/Transistor/BF240.pdf'},
};
export function bjtDeviceRating(model:string|undefined):BjtDeviceRating|undefined{const value=ratings[(model??'').trim().toUpperCase()];return value?{...value}:undefined;}
