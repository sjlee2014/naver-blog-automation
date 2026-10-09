#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {POLICY,profile,fingerprint}=require('./lib/regional_keyword_rules.cjs');
// Discovery seeds only. Never labels a region/keyword as researched or approved.
function seedQueue(index, demandRows, asOf, startDate){
 const regions=['용산','영등포','동작구','관악구','마포','서대문구','은평구','강서구','양천구','금천구','노원구','도봉구','김포','하남'];
 const terms={mark1:['누수탐지','아파트누수'],mark2:['누수석고보드교체','누수목공'],mark3:['누수도배','천장누수도배'],mark5:['누수피해복구','누수복구업체']};
 const history=index.map(r=>{const brief=r.plan?.conversionBrief;return{profile:profile(r.account||r.profile),title:r.title,keyword:r.keyword||'',url:(r.url||'').split('?')[0],publishedAt:r.rssPublishedAt||r.publishedAt||null,answerKey:brief?.answerKey||null,questionKey:brief?.intent?.questionKey||null};});
 const candidates=POLICY.profiles.flatMap((account,a)=>regions.map((_,i)=>{
  const region=regions[(i+a*3)%regions.length],serviceTerm=terms[account][i%2],keyword=region+serviceTerm;
  const d=demandRows.find(x=>x.keyword===keyword);
  return{id:`${account}-region-${i+1}`,profile:account,keyword,status:'NEEDS_RESEARCH',
   demand:d?.exact?{keyword,pc:d.exact.monthlyPcQcCnt,mobile:d.exact.monthlyMobileQcCnt,checkedAt:d.checkedAt,source:'naver_searchad_exact'}:null,
   intent:{service:POLICY.lanes[account],region,damageTarget:null,questionKey:null,customerQuestion:null,desiredAction:'consultation'},
   regional:{region,serviceTerm,serviceAreaVerified:false,serviceAreaSource:null,regionIndependentAnswerKey:null,contentBasis:null},
   researchTasks:['서비스 가능 지역 확인','공식 exact 수요 확보','통합검색의 지역 서비스 의도 확인','네 계정 본문과 지역명을 가린 답변 비교','새 답변을 뒷받침할 현장/기술 자료 확인'],
   relatedHistory:history.filter(h=>h.title?.includes(region)).map(h=>({title:h.title,url:h.url,profile:h.profile})),
  };
 }));
 return{asOf,startDate,history,candidates,historyFingerprint:fingerprint(history),note:'56 discovery seeds; NOT 56 approved topics. Refresh public/draft/reserved history before review. Unknown old intent keys require human body comparison.'};
}
module.exports={seedQueue};
if(require.main===module){
 const [indexFile,demandFile,outputFile,asOf,startDate]=process.argv.slice(2);
 if(!startDate)throw Error('Usage: node prepare_regional_queue.cjs INDEX.json DEMAND.json NEW_OUTPUT.json AS_OF START_DATE');
 const source=JSON.parse(fs.readFileSync(demandFile,'utf8'));
 const result=seedQueue(JSON.parse(fs.readFileSync(indexFile,'utf8')),source.rows.map(r=>({...r,checkedAt:source.checkedAt})),asOf,startDate);
 fs.mkdirSync(path.dirname(outputFile),{recursive:true});fs.writeFileSync(outputFile,JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({outputFile,candidates:result.candidates.length,history:result.history.length}));
}
