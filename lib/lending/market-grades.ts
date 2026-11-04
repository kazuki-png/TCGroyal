// Read-only public product condition definitions verified 2026-11-04.
// A declaration matches its own category; never substitute PSA10 prices.
export function marketGrade(grade:string):{key:string;ids:number[];labels:string[]}|null{
 const key=grade.normalize('NFKC').replace(/\s/g,'').toUpperCase()
 const singles:Record<string,[number,string]>={PSA10:[22,'PSA10'],PSA9:[23,'PSA9'],'PSA8以下':[24,'PSA8以下'],BGS10BL:[25,'BGS10 BL'],BGS10GL:[26,'BGS10 GL'],'BGS9.5':[27,'BGS9.5'],'BGS9以下':[28,'BGS9以下'],'ARS10+':[29,'ARS10+'],ARS10:[30,'ARS10'],ARS9:[31,'ARS9'],'ARS8以下':[32,'ARS8以下'],'その他鑑定':[33,'他鑑定品'],'他鑑定品':[33,'他鑑定品']}
 if(key==='PSA9以下')return {key,ids:[23,24],labels:['PSA9','PSA8以下']}
 if(key==='未鑑定'||key==='UNGRADED')return {key:'未鑑定',ids:[18,19,20,21],labels:['A','B','C','D']}
 const item=singles[key];return item?{key,ids:[item[0]],labels:[item[1]]}:null
}
