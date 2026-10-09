'use strict';
// 2026-09-28 user instruction: presentation is user-managed.
const policy = Object.freeze({automaticCaptions:false,automaticAiNotices:false,automaticAiToggleChanges:false,publicReferenceBlocks:false,bodyTags:false,bodySubheadings:false});
function assertPresentationPolicy(text='',blocks=[]) {
 const body=String(text)+'\n'+blocks.filter(b=>b.type!=='image').map(b=>b.text||'').join('\n');
 const errors=[];
 if (/(?:AI|인공지능)[^\n.!?]{0,100}(?:이미지|사진|예시)|(?:이미지|사진)[^\n.!?]{0,100}(?:AI|인공지능)|실제\s*고객\s*현장[^\n.!?]{0,60}(?:아닙|아니|무관)/iu.test(body)) errors.push('automatic AI image notice');
 if (/^\s*(?:#{1,6}\s*)?(?:참고(?:문헌|자료)?|출처)\s*[:：]|^\s*https?:\/\/\S+\s*$/mu.test(body)) errors.push('public research references');
 if (/^!\[[^\]\n]+\]\([^\n]+\)$/mu.test(body)||/<figcaption\b/iu.test(body)||blocks.some(b=>b.type==='image'&&String(b.caption||'').trim())) errors.push('automatic image caption');
 if(blocks.some(b=>b.type==='image'&&(b.aiMarked!==undefined||b.aiToggle!==undefined))) errors.push('automatic AI toggle instruction');
 if(/설명용\s*이미지[^\n.!?]{0,100}(?:실제\s*작업|섞)|이\s*예시는\s*작성\s*구조|이\s*문구는[^\n.!?]{0,70}실제로[^\n.!?]{0,40}아니|(?:내부규칙|선정\s*로직|preflight|매니페스트|검증\s*통과)/iu.test(body)) errors.push('internal authoring instructions');
 if(/^\s*#{2,6}\s+|<h[2-6]\b/imu.test(body)||blocks.some(b=>b.type==='heading')) errors.push('body subheading');
 if(/^\s*태그\s*[:：]|(?:^|\s)#[가-힣A-Za-z0-9_]+/mu.test(body)||blocks.some(b=>b.blockRole==='tags')) errors.push('body tags');
 if(errors.length)throw new Error('BLOG_PRESENTATION_POLICY: '+errors.join(', '));
 return {status:'PASS',...policy};
}
module.exports={policy,assertPresentationPolicy};
