#!/usr/bin/env node
'use strict';
// Local planning only. No publication, browser interaction, or fabricated evidence.
const fs=require('fs'),path=require('path');
const {evaluateCandidate,compare}=require('./mark_four_stage_preflight');
const {POLICY,profile,day,fingerprint}=require('./lib/regional_keyword_rules.cjs');
function buildPlan(input) {
  if (!Array.isArray(input.history)||!Array.isArray(input.candidates)||!day(input.asOf)) throw Error('asOf, history and candidates are required');
  const start=input.startDate||day(input.asOf);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)||day(start+'T00:00:00+09:00')!==start||start<day(input.asOf)) throw Error('Invalid or past startDate');
  const ids=new Set();for(const c of input.candidates){if(!c.id||ids.has(c.id))throw Error('Unique candidate id required');ids.add(c.id);}
  const history=input.history.map(h=>({...h,profile:profile(h.profile||h.account)}));
  const originalFingerprint=fingerprint(history), selectedIds=new Set(), slots=[], simulated=[...history];
  const context=asOf=>({asOf,history:simulated,historyFingerprint:originalFingerprint,selectionMode:'regional_daily'});
  const timeFor=date=>date===day(input.asOf)?input.asOf:date+'T23:59:59+09:00';
  for(let offset=0;offset<POLICY.primaryDays;offset++) {
    const date=day(Date.parse(start+'T00:00:00+09:00')+offset*864e5);
    // Rotate account order so one account does not permanently win shared candidates.
    const order=POLICY.profiles.slice(offset%4).concat(POLICY.profiles.slice(0,offset%4));
    for(const account of order){
      const existing=history.filter(h=>h.profile===account&&day(h.publishedAt||h.reservedAt)===date);
      if(existing.length){slots.push({date,profile:account,status:'ALREADY_OCCUPIED',existing:existing.map(h=>h.url||h.draftIdentity||h.keyword)});continue;}
      const reviewed=input.candidates.filter(c=>profile(c.profile)===account&&!selectedIds.has(c.id)).map(c=>evaluateCandidate({...c,profile:account},context(timeFor(date))));
      const eligible=reviewed.filter(c=>c.hardGate.status==='PASS').sort(compare);
      // Experiments are a bounded fallback when no validated standard candidate is ready.
      const chosen=eligible.find(c=>c.demandTier==='STANDARD')||eligible[0];
      if(!chosen){slots.push({date,profile:account,status:'NEEDS_RESEARCH',rejections:reviewed.map(c=>({id:c.id,keyword:c.keyword,reasons:c.hardGate.issues}))});continue;}
      selectedIds.add(chosen.id);
      const reservation={profile:account,keyword:chosen.keyword,questionKey:chosen.intent.questionKey,answerKey:chosen.answerKey,
        reservedAt:timeFor(date),draftIdentity:`regional:${date}:${account}:${chosen.id}`,demandTier:chosen.demandTier};
      simulated.push(reservation);
      slots.push({date,profile:account,status:'PLANNED',candidate:chosen,reservation,selectionReason:chosen.demandTier==='EXPERIMENT'?'검증된 일반 후보 부족: 주간 한도 내 지역 소수요 실험':'문의 적합성·추가 가치·성과 근거·경쟁 대응·수요 순',
        alternatives:eligible.filter(c=>c.id!==chosen.id).slice(0,3).map(c=>({id:c.id,keyword:c.keyword,rankVector:c.rankVector,reason:c.demandTier!==chosen.demandTier?'EXPERIMENT_HELD_FOR_STANDARD':'LOWER_PRIORITY_OR_TIEBREAK'}))});
    }
  }
  // Reserve pool: ready as of today, not a second promise of future publication.
  const reserves={},coverage={};
  for(const account of POLICY.profiles){
    const candidates=input.candidates.filter(c=>profile(c.profile)===account&&!selectedIds.has(c.id));
    const ready=candidates.map(c=>evaluateCandidate(c,context(input.asOf))).filter(c=>c.hardGate.status==='PASS').sort(compare);
    const unique=[];for(const c of ready){if(unique.some(x=>x.answerKey===c.answerKey||x.intent.questionKey===c.intent.questionKey))continue;unique.push(c);if(unique.length===POLICY.reserveTarget)break;}
    reserves[account]=unique.map(c=>({id:c.id,keyword:c.keyword,demandTier:c.demandTier,revalidateBeforeUse:true}));
    for(const c of unique)simulated.push({profile:account,keyword:c.keyword,questionKey:c.intent.questionKey,answerKey:c.answerKey,reservedAt:input.asOf,draftIdentity:`reserve:${c.id}`});
    const own=slots.filter(s=>s.profile===account), planned=own.filter(s=>s.status==='PLANNED').length, occupied=own.filter(s=>s.status==='ALREADY_OCCUPIED').length;
    coverage[account]={planned,occupied,missing:7-planned-occupied,reserveReady:unique.length,reserveMissing:7-unique.length};
  }
  return {version:POLICY.version,asOf:input.asOf,startDate:start,historyFingerprint:originalFingerprint,
    status:Object.values(coverage).some(x=>x.missing||x.reserveMissing)?'NEEDS_RESEARCH':'READY',
    policy:POLICY,coverage,slots,reserves,
    note:'PLANNED is a local keyword reservation, not a saved or published article. Revalidate daily against current history and evidence. Missing slots never bypass gates.'};
}
module.exports={buildPlan};
if(require.main===module){
  try{
    const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),result=buildPlan(input);
    const output=process.argv[3];if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2));}
    else console.log(JSON.stringify(result,null,2));
    console.error(JSON.stringify({status:result.status,coverage:result.coverage}));
    process.exitCode=result.status==='READY'?0:2;
  }catch(e){console.error(e.message);process.exitCode=1;}
}
