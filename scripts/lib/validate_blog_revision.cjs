'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {select,compact}=require('../mark_four_stage_preflight.js');
function validateRevision(dir,account){
 const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));
 const manifest=read('image-manifest.json'),spec=manifest.articles[account];
 if(!spec?.revision||!spec.oldTitle||!spec.draftIdentity)throw Error('Existing draft identity required');
 const input=read(`${account}-preflight-input.json`),report=select(input.candidates,input.context);
 if(report.status!=='PASS'||compact(report.selected.keyword)!==compact(spec.keyword))throw Error('Keyword preflight failed');
 const article=fs.readFileSync(path.join(dir,`${account}.md`),'utf8');
 if(article.split(/\r?\n/)[0]!==`# ${spec.title}`||!compact(spec.title).includes(compact(spec.keyword)))throw Error('Title keyword mismatch');
 require('./blog_presentation_policy.cjs').assertPresentationPolicy(article);
 const count=article.replace(/^!\[.*\].*$/gm,'').length;
 if(count<spec.minTextChars)throw Error('Body baseline not met');
 const refs=[...article.matchAll(/^!\[[^\]]*\]\(([^)]+)\)$/gm)].map(m=>path.resolve(dir,m[1]));
 if(count<report.selected.baseline.minTextLength||refs.length<report.selected.baseline.minImageCount)throw Error('Selected content baseline not met');
 const jobs=manifest.jobs.filter(j=>j.account===account);
 if(refs.length!==spec.imageCount||jobs.length!==refs.length)throw Error('Image baseline mismatch');
 const norm=x=>x.normalize('NFC');const hashes=new Set();
 for(const [i,j]of jobs.entries()){
  if(norm(j.expectedPath)!==norm(refs[i]))throw Error('Manifest ordering mismatch');
  const sha=crypto.createHash('sha256').update(fs.readFileSync(refs[i])).digest('hex');
  if(j.sha256!==sha||hashes.has(sha)||j.visualReview!=='PASS')throw Error('Image hash/duplicate/review failed');hashes.add(sha);
  if(j.sourceType==='field'&&(!j.sourceCatalogId||j.privacyStatus!=='PASS'))throw Error('Field source/privacy missing');
  if(j.sourceType==='field'){
   const root=path.resolve(__dirname,'../..');
   const catalog=JSON.parse(fs.readFileSync(path.join(root,'private/kakao-field-photos/catalog.json'),'utf8')).entries;
   const entry=catalog.find(e=>e.id===j.sourceCatalogId);
   if(!entry||entry.cleanHash!==sha||entry.privacy?.status!=='PASS')throw Error('Catalog source/privacy mismatch');
   if((entry.usedBy||[]).some(u=>norm(path.resolve(root,u.manifestPath))!==norm(j.originalManifest)&&u.draftIdentity!==spec.draftIdentity))throw Error('Field photo used in another draft');
  }
  if(j.sourceType==='ai'&&(!j.prompt||!j.sourceGeneratedPath||!fs.existsSync(j.sourceGeneratedPath)))throw Error('AI provenance missing');
  if(j.freshness==='retained-from-same-existing-draft'){
   if(j.originalDraftTitle!==spec.oldTitle)throw Error('Cross-draft reuse disallowed');
   const prior=JSON.parse(fs.readFileSync(j.originalManifest,'utf8'));
   if(!prior.jobs.some(p=>p.account===account&&p.sha256===sha))throw Error('Original draft lineage missing');
  }else if(j.freshness!=='generated-for-this-revision')throw Error('Freshness unverified');
 }
// No minimum field-photo count: fresh AI images may fill all planned roles.
 return {status:'PASS',account,title:spec.title,bodyChars:count,imageCount:refs.length,fieldPhotos:jobs.filter(j=>j.sourceType==='field').length};
}
module.exports={validateRevision};
if(require.main===module)console.log(JSON.stringify(validateRevision(path.resolve(process.argv[2]),process.argv[3])));
