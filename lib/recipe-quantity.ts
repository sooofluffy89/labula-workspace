import type {Item,RecipeInput} from './notebook';

export type InputUnit=Item['unit'];
export const inputUnit=(part:RecipeInput,item:Pick<Item,'unit'>):InputUnit=>part.unit??item.unit;
/** A recorded count is usable as-is; base-unit calculations need an explicit conversion. */
export function baseInputAmount(part:RecipeInput,item:Pick<Item,'unit'>):number|null{
 if(part.amount===null)return null;
 const unit=inputUnit(part,item);if(unit===item.unit)return part.amount;
 const c=part.conversion;if(!c||c.from!==unit||c.to!==item.unit)return null;
 const value=part.amount*c.factor;return Number.isFinite(value)?value:null;
}
export function measurement(part:RecipeInput,item:Pick<Item,'unit'>){return {amount:part.amount,unit:inputUnit(part,item),pieceMeaning:part.pieceMeaning??'',conversion:part.conversion??null};}
export function measurementText(part:RecipeInput,item:Pick<Item,'unit'>){const unit=inputUnit(part,item),c=part.conversion;return `${part.amount??'Not recorded'} ${unit}${part.pieceMeaning?' · 1 pc = '+part.pieceMeaning:''}${c?' · 1 '+c.from+' = '+c.factor+' '+c.to:unit!==item.unit?' · Conversion to '+item.unit+' not recorded':''}`;}
export function hasMeasurementMetadata(part:RecipeInput){return part.unit!==undefined||part.pieceMeaning!==undefined||part.conversion!==undefined;}
export function missingMeasurementMetadata(before:RecipeInput,after:RecipeInput){return before.unit!==undefined&&after.unit===undefined||before.pieceMeaning!==undefined&&after.pieceMeaning===undefined||before.conversion!==undefined&&after.conversion===undefined&&before.unit===after.unit;}
