'use strict';
// Reconstructed from retained reports, 2026-09-26. Pure evaluator: no browser writes.
const fs=require('fs');
const {regionalRules,profile:canonicalProfile}=require('./lib/regional_keyword_rules.cjs');
const compact=x=>String(x||'').normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
function demandBound(raw){if(/^<\s*10$/.test(String(raw).trim()))return{lower:0,upperExclusive:10,raw};if(typeof raw==='number'&&Number.isFinite(raw)&&raw>=0)return{lower:raw,upperExclusive:null,raw};return{lower:null,upperExclusive:null,raw:raw??null};}
function validTime(x){return typeof x==='string'&&Number.isFinite(Date.parse(x));}
function evaluateCandidate(c,context){
 const issues=[],d=c.demand||{},pc=demandBound(d.pc),mobile=demandBound(d.mobile),s=c.serp||{},review=c.duplicateReview||{};
 const regional=context.selectionMode==='regional_daily'||c.regional ? regionalRules(c,context,{pc,mobile}) : null;
 if(regional)issues.push(...regional.issues);
 if(compact(d.keyword)!==compact(c.keyword)||pc.lower===null||mobile.lower===null||pc.lower+mobile.lower<10&&!regional?.demandAccepted||!validTime(d.checkedAt))issues.push('EXACT_DEMAND_UNVERIFIED');
 if(s.status!=='verified'||compact(s.query)!==compact(c.keyword)||s.surface!=='integrated'||!validTime(s.checkedAt)||!Array.isArray(s.relatedResults)||!s.relatedResults.some(r=>r.related===true&&/^https:\/\/(?:m\.)?blog\.naver\.com\/[^/]+\/\d+/.test(r.url)))issues.push('RELATED_INTEGRATED_BLOG_EVIDENCE_MISSING');
 if(c.serviceFit!==true||!c.intent?.service||!c.intent?.damageTarget||!c.intent?.questionKey||!c.intent?.customerQuestion||!c.intent?.desiredAction)issues.push('PROFILE_INTENT_UNVERIFIED');
 if(!c.answerKey||!c.differenceFromExisting||!c.newAnswerPoints?.length||!c.evidence?.some(e=>e.status==='verified'&&e.source))issues.push('ADDITIONAL_ANSWER_EVIDENCE_MISSING');
 if(review.status!=='reviewed'||!review.corpusPath||!Array.isArray(review.reviewedPostUrls)||!validTime(review.checkedAt))issues.push('SEMANTIC_DUPLICATE_REVIEW_MISSING');
 if(review.sameAnswer===true)issues.push('SAME_ANSWER');
 if(!Array.isArray(context.history)||!validTime(context.asOf))issues.push('HISTORY_CONTEXT_MISSING');
 for(const h of context.history||[]){
  if(h.draftIdentity&&h.draftIdentity===context.revisingDraftIdentity)continue;
  const evidenceDate=h.publishedAt||h.reservedAt;
  // Unknown dates never treated as zero days or expired restrictions.
  const sameKeyword=compact(h.keyword)===compact(c.keyword),sameIntent=h.questionKey===c.intent?.questionKey;
  const days=validTime(evidenceDate)?(Date.parse(context.asOf)-Date.parse(evidenceDate))/864e5:null;
  if(h.answerKey&&h.answerKey===c.answerKey)issues.push('SAME_ANSWER');
  if(canonicalProfile(h.profile||h.account)===canonicalProfile(c.profile)&&sameKeyword&&(days===null||days<7))issues.push('SAME_ACCOUNT_7D_KEYWORD');
  if(canonicalProfile(h.profile||h.account)!==canonicalProfile(c.profile)&&sameIntent&&(days===null||days<60))issues.push('CROSS_ACCOUNT_60D_INTENT');
 }
 const ranks=c.priority||{};const rankVector=['inquiryFit','additionalValue','accountEvidence','competitiveGap'].map(k=>Number.isFinite(ranks[k])?ranks[k]:null).concat(pc.lower===null||mobile.lower===null?null:pc.lower+mobile.lower);
 return {...c,demandTier:regional?.tier||null,hardGate:{status:issues.length?'FAIL':'PASS',issues:[...new Set(issues)]},demandBounds:{pc,mobile,knownMinimum:pc.lower===null||mobile.lower===null?null:pc.lower+mobile.lower},rankVector,performance:c.performance??null};
}
function compare(a,b){for(let i=0;i<a.rankVector.length;i++){const x=a.rankVector[i],y=b.rankVector[i];if(x===null||y===null)continue;if(x!==y)return y-x;}return a.keyword.localeCompare(b.keyword,'ko');}
function select(candidates,context){const reviewed=candidates.map(c=>evaluateCandidate(c,context));const eligible=reviewed.filter(c=>c.hardGate.status==='PASS').sort(compare);return{version:'reconstructed-2026-09-26',checkedAt:new Date().toISOString(),status:eligible.length?'PASS':'NO_ELIGIBLE_CANDIDATE',selected:eligible[0]||null,ranked:eligible,rejected:reviewed.filter(c=>c.hardGate.status!=='PASS'),note:'Human evidence review is required; counts or supplied PASS flags alone do not establish source truth.'};}
module.exports={compact,demandBound,evaluateCandidate,compare,select};
if(require.main===module){const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const result=select(input.candidates,input.context);if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));else console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:2;}
