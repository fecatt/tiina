import library from './library.json' with {type:'json'};
export type BjtModel={polarity:string;parameters_b64:string;description?:string};
/** Names belong to a polarity and model family, not a global flat namespace. */
export function bjtModels(polarity:string):Record<string,BjtModel>{
 const data=library as unknown as {bjt_catalog?:Record<string,Record<string,BjtModel>>;bjt_models:Record<string,BjtModel>};
 return data.bjt_catalog?.[polarity]??Object.fromEntries(Object.entries(data.bjt_models).filter(([,m])=>m.polarity===polarity));
}
