/** Row names/order observed in the original property grids of all 16 editable
 * creation kinds (reports/native-property-families). Values are not guessed:
 * undecoded fields are rendered disabled and their TSC bytes stay untouched. */
export type PropertyRow={label:string;flag?:boolean};
const row=(label:string,flag=false):PropertyRow=>({label,flag});
const temperature=[row('Температура'),row('Температура [°C]',true)];
const coefficients=[row('Линейный темп. коэф. [1/°C]',true),row('Квадратный темп. коэф. [1/°C²]',true)];
const error=row('Ошибка');
const limits=[row('Максимальное напряжение [В]',true)];
const initialDC=row('Первоначально устройство выключено(DC)');
const diode=[...temperature,row('Коэффициент площади',true),initialDC,row('Первоначальное напряжение (TR)',true),error];
const source=[row('Внутреннее сопротивление [Ом]',true),row('Состояние ввода/вывода'),error];
const profiles:Record<string,PropertyRow[]>={
 R:[row('Мощность [Вт]',true),...temperature,...coefficients,row('Экспоненциальный темп. коэф. [%/°C]',true),...limits,error],
 C:[row('RPar [Ом]',true),row('DC напряжение [В]',true),...temperature,...coefficients,...limits,row('Максимальный первый ток [А]',true),error],
 L:[row('RSer [Ом]',true),row('DC ток [А]',true),...temperature,...coefficients,...limits,row('Максимальный ток [А]',true),error],
 V:source,VS:source,I:source,VG:source,IS:source,
 D:diode,ZENER:diode,SCHOTTKY:diode,
 NPN:[row('Емкость',true),...temperature,row('Коэффициент площади',true),initialDC,row('Первоначальное B-E напряжение (TR)',true),row('Первоначальное C-E напряжение (TR)',true),error],
};
profiles.PNP=profiles.NPN;
export const componentPropertyRows=(kind:string):readonly PropertyRow[]=>profiles[kind]??[];
