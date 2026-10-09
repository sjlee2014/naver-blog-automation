const test=require('node:test'),assert=require('node:assert/strict');
const {buildPlan}=require('./regional_keyword_planner.cjs');
const {evaluateCandidate}=require('./mark_four_stage_preflight');
const {POLICY,fingerprint,day}=require('./lib/regional_keyword_rules.cjs');
const now='2026-09-27T10:00:00+09:00';
function candidate(account='mark1',i=0,low=false){
 const region=`지역${i}`,keyword=region+' 누수복구',key=`${account}-answer-${i}`;
 return {id:`${account}-${i}`,profile:account,keyword,serviceFit:true,
 demand:{keyword,pc:low?'< 10':10,mobile:low?'< 10':40,source:'naver_searchad_exact',checkedAt:now},
 serp:{status:'verified',query:keyword,surface:'integrated',checkedAt:now,intent:'local_service',intentReason:'local restoration examples',relatedResults:[{related:true,url:'https://blog.naver.com/fixture/123'}]},
 intent:{service:POLICY.lanes[account],region,damageTarget:'ceiling',questionKey:key,customerQuestion:'unique question '+i,desiredAction:'estimate'},
 answerKey:key,differenceFromExisting:'different actual evidence '+i,newAnswerPoints:['new point'],evidence:[{status:'verified',source:'fixture'}],
 duplicateReview:{status:'reviewed',corpusPath:'fixture',reviewedPostUrls:[],noRelatedPostsReason:'fixture empty corpus',checkedAt:now,sameAnswer:false,regionMaskedReview:true,answerComparison:'different answer',historyFingerprint:fingerprint([])},
 priority:{inquiryFit:3,additionalValue:3,competitiveGap:2},
 regional:{region,serviceTerm:'누수복구',serviceAreaVerified:true,serviceAreaSource:'fixture',regionIndependentAnswerKey:key,experimentHypothesis:'local inquiry test',contentBasis:{type:'service_guide',source:'fixture',newEvidenceDescription:'new conditions '+i}}};
}
const ctx={asOf:now,history:[],historyFingerprint:fingerprint([]),selectionMode:'regional_daily'};
test('four daily slots and seven reserves each, deterministic and no reuse',()=>{
 const input={asOf:now,history:[],candidates:POLICY.profiles.flatMap(a=>Array.from({length:14},(_,i)=>candidate(a,i)))};
 const p=buildPlan(input);assert.equal(p.status,'READY');assert.equal(p.slots.length,28);assert.equal(new Set(p.slots.map(s=>s.candidate.id)).size,28);
 assert.deepEqual(p,buildPlan(input));for(const a of POLICY.profiles)assert.equal(p.reserves[a].length,7);
});
test('censored demand can pass with evidence, missing or zero cannot',()=>{
 let c=candidate('mark1',0,true);assert.equal(evaluateCandidate(c,ctx).hardGate.status,'PASS');
 c.demand.pc=null;assert.equal(evaluateCandidate(c,ctx).hardGate.status,'FAIL');
 c.demand.pc=0;c.demand.mobile=0;assert.equal(evaluateCandidate(c,ctx).hardGate.status,'FAIL');
});
test('unknown fetch / missing related SERP cannot become fallback',()=>{
 let c=candidate('mark1',0,true);c.serp.status='fetch_failed';assert.equal(evaluateCandidate(c,ctx).hardGate.status,'FAIL');
});
test('low demand budget limits each account to two per rolling seven days',()=>{
 const p=buildPlan({asOf:now,history:[],candidates:Array.from({length:8},(_,i)=>candidate('mark1',i,true))});
 assert.equal(p.slots.filter(s=>s.status==='PLANNED').length,2);assert.equal(p.coverage.mark1.missing,5);
});
test('different region cannot escape same answer or cross-account intent',()=>{
 let c=candidate();const h=[{profile:'gomterior',answerKey:c.answerKey,questionKey:c.intent.questionKey,publishedAt:'2026-09-20'}];
 c.duplicateReview.historyFingerprint=fingerprint(h);
 const result=evaluateCandidate(c,{...ctx,history:h,historyFingerprint:fingerprint(h)});
 assert(result.hardGate.issues.includes('SAME_ANSWER'));assert(result.hardGate.issues.includes('CROSS_ACCOUNT_60D_INTENT'));
});
test('new history invalidates semantic review',()=>{
 const c=candidate();const h=[{profile:'mark2',title:'new post',url:'https://blog.naver.com/fixture/456'}];
 assert(evaluateCandidate(c,{...ctx,history:h,historyFingerprint:fingerprint(h)}).hardGate.issues.includes('REGIONAL_HISTORY_REVIEW_STALE'));
});
test('future reservations block duplicate intent and occupied dates skip',()=>{
 const c=candidate();const h=[{profile:'mark3',questionKey:c.intent.questionKey,reservedAt:'2026-09-28T06:00:00+09:00'}];
 c.duplicateReview.historyFingerprint=fingerprint(h);
 assert(evaluateCandidate(c,{...ctx,history:h,historyFingerprint:fingerprint(h)}).hardGate.issues.includes('CROSS_ACCOUNT_60D_INTENT'));
 const p=buildPlan({asOf:now,history:[{profile:'leak',publishedAt:now,url:'fixture'}],candidates:[]});
 assert.equal(p.slots.find(s=>s.profile==='mark1'&&s.date==='2026-09-27').status,'ALREADY_OCCUPIED');
});
test('stale evidence, wrong lane and unsupported region fail',()=>{
 let c=candidate();c.serp.checkedAt='2026-08-01';c.regional.serviceAreaVerified=false;c.intent.service='other';
 const issues=evaluateCandidate(c,ctx).hardGate.issues;assert(issues.includes('REGIONAL_SERP_STALE'));assert(issues.includes('SERVICE_AREA_UNVERIFIED'));assert(issues.includes('REGIONAL_ACCOUNT_LANE_MISMATCH'));
});
test('KST midnight and empty pool are explicit',()=>{
 assert.equal(day('2026-09-27T15:00:00Z'),'2026-09-28');const p=buildPlan({asOf:now,history:[],candidates:[]});assert.equal(p.status,'NEEDS_RESEARCH');assert.equal(p.slots.filter(s=>s.status==='NEEDS_RESEARCH').length,28);
});
test('experiment history without draft identity still consumes quota',()=>{
 const c=candidate('mark1',0,true),history=[1,2].map(i=>({profile:'mark1',demandTier:'EXPERIMENT',publishedAt:`2026-09-2${i}`}));
 c.duplicateReview.historyFingerprint=fingerprint(history);
 assert(evaluateCandidate(c,{...ctx,history,historyFingerprint:fingerprint(history)}).hardGate.issues.includes('REGIONAL_EXPERIMENT_WEEKLY_LIMIT'));
});
test('standard queue precedes experimental filler; unverified metrics stay null',()=>{
 const standard=candidate('mark1',0),small=candidate('mark1',1,true);small.priority.inquiryFit=99;
 const p=buildPlan({asOf:now,history:[],candidates:[small,standard]});
 assert.equal(p.slots[0].candidate.id,standard.id);assert.equal(p.slots[0].candidate.performance,null);
});
test('case evidence needs matching confirmed region',()=>{
 const c=candidate();c.regional.contentBasis={type:'verified_case',source:'fixture',newEvidenceDescription:'case',actualWorkConfirmed:true,region:'other'};
 assert(evaluateCandidate(c,ctx).hardGate.issues.includes('REGIONAL_CASE_UNVERIFIED'));
});
test('legacy non-regional censored demand still cannot bypass gate',()=>{
 const c=candidate('mark1',0,true);delete c.regional;
 assert(evaluateCandidate(c,{asOf:now,history:[]}).hardGate.issues.includes('EXACT_DEMAND_UNVERIFIED'));
});
