const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertPresentationPolicy,policy}=require('../lib/blog_presentation_policy.cjs');
test('blocks whole-post AI disclaimer including mixed-photo drafts',()=>assert.throws(()=>assertPresentationPolicy('이 글의 이미지는 이해를 돕기 위해 AI로 제작한 예시이며 실제 고객 현장이나 측정 결과가 아닙니다.')));
test('blocks automatic captions and bibliography',()=>{
 for(const text of ['![현장 사진](a.png)','사진 — AI 설명용 이미지','참고: 제조사 안내\nhttps://example.com','<figcaption>설명</figcaption>'])assert.throws(()=>assertPresentationPolicy(text));
});
test('allows unlabeled mixed-source images and ordinary article text',()=>assert.equal(assertPresentationPolicy('# 하남누수도배\n![](a.png)\n![](b.png)\n마감 범위를 확인합니다.',[{type:'image',sourceType:'field'},{type:'image',sourceType:'ai'}]).status,'PASS'));
test('does not infer toggle state from source type',()=>{
 assert.equal(policy.automaticAiToggleChanges,false);
 assert.throws(()=>assertPresentationPolicy('',[{type:'image',aiMarked:true}]));
});
test('blocks internal writing rules leaked into customer-facing prose',()=>{
 for(const text of ['설명용 이미지를 실제 작업 기록 사이에 섞지는 마세요.','이 예시는 작성 구조이며 실제 검사 수치나 특정 집의 결과가 아닙니다.','선정 로직과 preflight를 통과했습니다.'])assert.throws(()=>assertPresentationPolicy(text));
});
test('allows practical customer record-keeping advice',()=>assert.equal(assertPresentationPolicy('보강한 위치와 판재를 교체한 범위를 사진에 표시해 달라고 요청하세요.').status,'PASS'));
test('all accounts reject body headings and hashtags but allow the main title',()=>{
 for(const text of ['## 공사 후 확인','태그: #용산누수','#용산누수 #복구','<h2>확인 순서</h2>'])assert.throws(()=>assertPresentationPolicy(text));
 assert.throws(()=>assertPresentationPolicy('',[{type:'heading',text:'공사 후 확인'}]));
 assert.equal(assertPresentationPolicy('# 용산누수피해복구\n\n사진과 작업 내용을 함께 확인하세요.').status,'PASS');
});
