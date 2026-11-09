export function canonicalBarcode(value) {
  const s = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^(?:\d{8}|\d{12,14})$/.test(s)) return null;
  let sum = 0;
  for (let i=s.length-2, weight=3;i>=0;i--,weight=4-weight) sum += Number(s[i])*weight;
  if ((10-sum%10)%10 !== Number(s.at(-1))) return null;
  return s.padStart(14,'0');
}
export function exactMatches(foods, barcode) {
  const key=canonicalBarcode(barcode);
  return key ? foods.filter(f=>canonicalBarcode(f.gtinUpc)===key).sort((a,b)=>String(b.publicationDate??'').localeCompare(String(a.publicationDate??''))) : [];
}
export const metrics = [
  ['calories','Calories','kcal',1008], ['protein','Protein','g',1003],
  ['carbohydrates','Carbohydrate','g',1005], ['fiber','Fiber','g',1079],
  ['sugars','Total sugars','g',2000], ['addedSugar','Added sugars','g',1235],
  ['fat','Total fat','g',1004], ['saturatedFat','Saturated fat','g',1258], ['sodium','Sodium','mg',1093]
];
export function normalizeFood(food) {
  const label=food.labelNutrients??{};
  const nutrients={};
  const gramServing=String(food.servingSizeUnit).toLowerCase()==='g' && Number(food.servingSize)>0;
  for (const [key,,unit,id] of metrics) {
    const n=(food.foodNutrients??[]).find(x=>x.nutrient?.id===id || x.nutrientId===id);
    const raw=n?.amount??n?.value;
    const validRaw=typeof raw==='number' && Number.isFinite(raw) && raw>=0;
    const actualUnit=String(n?.nutrient?.unitName??n?.unitName??'').toLowerCase();
    const per100=validRaw && actualUnit===unit.toLowerCase() ? raw : null;
    const lv=label[key]?.value;
    const serving=typeof lv==='number' && Number.isFinite(lv) && lv>=0 ? lv : gramServing && per100!==null ? per100*food.servingSize/100 : null;
    nutrients[key]={unit,serving,per100};
  }
  return {id:food.fdcId,name:food.description,brand:food.brandName??food.brandOwner??'',barcode:food.gtinUpc,serving:[food.servingSize,food.servingSizeUnit].filter(x=>x!=null).join(' '),household:food.householdServingFullText??'',date:food.publicationDate??food.modifiedDate??'',ingredients:food.ingredients??'',nutrients};
}
