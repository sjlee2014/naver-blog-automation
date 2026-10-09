'use strict';
// Scope-specific latest successful observation. Lookup failure is not non-exposure.
function latestExposure(observations,{keyword,surface,scope}){
 const rows=observations.filter(o=>o.keyword===keyword&&o.surface===surface&&o.scope===scope&&o.fetchStatus==='success'&&Number.isFinite(Date.parse(o.checkedAt))).sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt));
 return rows[0]||null;
}
module.exports={latestExposure};
