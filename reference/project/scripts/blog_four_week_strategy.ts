#!/usr/bin/env node
if (require.main === module) throw new Error('Source reference only; private browser/login adapters are deliberately excluded.');
// Reconstructed sequential revision runner. Does not schedule, publish or invent candidates.
const path=require('path'),{spawnSync}=require('child_process');
if(process.argv[2]==='--regional-plan'){
 const r=spawnSync(process.execPath,[path.join(__dirname,'regional_keyword_planner.cjs'),...process.argv.slice(3)],{stdio:'inherit'});
 process.exit(r.status??1);
}
const {validateRevision}=require('./lib/validate_blog_revision.cjs');
const dir=path.resolve(process.argv[2]||'drafts/2026-09-26/rewrite');
const accounts=process.argv.slice(3);if(!accounts.length)accounts.push('mark1','mark2','mark3','mark5');
for(const account of accounts)console.log(JSON.stringify(validateRevision(dir,account)));
if(!process.env.SAVE_REVIEWED_DRAFTS){console.log('Validation only. Set SAVE_REVIEWED_DRAFTS=1 for sequential existing-draft saves with visual QA.');process.exit(0);}
(async()=>{for(const account of accounts){
 const names={mark1:'leak',mark2:'mark2',mark3:'gomterior',mark5:'mark5'};
 const profile=require('../blog_profiles').getProfileOrThrow(names[account]);
 await require('./lib/naver_shared_browser').startDedicatedBrowser({cookieFile:profile.cookieFile});
 for(const script of ['write_mark_posts.ts','verify_mark_draft.cjs']){
  const r=spawnSync(process.execPath,[path.join(__dirname,script),account,dir],{stdio:'inherit'});
  if(r.status!==0)throw Error(`${account} ${script} failed; no further accounts edited`);
 }
}})().catch(e=>{console.error(e.message);process.exitCode=1});
