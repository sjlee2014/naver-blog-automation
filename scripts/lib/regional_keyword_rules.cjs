'use strict';
const crypto = require('crypto');
const POLICY = Object.freeze({
  version: 'regional-v1-2026-09-27', profiles: ['mark1', 'mark2', 'mark3', 'mark5'],
  primaryDays: 7, reserveTarget: 7, experimentMaxPer7Days: 2,
  demandMaxAgeDays: 30, serpMaxAgeDays: 7, reviewMaxAgeDays: 7,
  lanes: {mark1: 'leak_detection', mark2: 'carpentry_restoration', mark3: 'wallpaper_restoration', mark5: 'restoration_contract'},
});
const compact = x => String(x || '').normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
const profile = x => ({leak:'mark1', gomterior:'mark3'}[x] || x);
const day = x => {const t=typeof x==='number'?x:Date.parse(x);return Number.isFinite(t)?new Date(t+9*3600000).toISOString().slice(0,10):null;};
function fingerprint(history) {
  return crypto.createHash('sha256').update(JSON.stringify(history.map(h => ({
    profile: profile(h.profile || h.account), keyword:h.keyword || '', title:h.title || '',
    url:(h.url || '').split('?')[0], answerKey:h.answerKey || '', questionKey:h.questionKey || '',
    reservedAt:h.reservedAt || null, publishedAt:h.publishedAt || null, draftIdentity:h.draftIdentity || null,
  })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');
}
function fresh(value, asOf, days) {
  const age = (Date.parse(asOf)-Date.parse(value))/864e5;
  return Number.isFinite(age) && age >= 0 && age <= days;
}
function regionalRules(c, context, bounds) {
  const issues=[], r=c.regional || {}, review=c.duplicateReview || {};
  const minimum=bounds.pc.lower === null || bounds.mobile.lower === null ? null : bounds.pc.lower+bounds.mobile.lower;
  const censored = bounds.pc.upperExclusive === 10 || bounds.mobile.upperExclusive === 10;
  const tier=minimum === null ? 'UNVERIFIED' : minimum < 30 ? 'EXPERIMENT' : 'STANDARD';
  // Explicit zero/zero is not censored demand. A failed/missing query is never an experiment.
  const demandAccepted = minimum !== null && (minimum > 0 || censored)
    && c.demand?.source === 'naver_searchad_exact' && compact(c.demand.keyword) === compact(c.keyword)
    && fresh(c.demand.checkedAt, context.asOf, POLICY.demandMaxAgeDays);
  if (!demandAccepted) issues.push('REGIONAL_EXACT_DEMAND_MISSING_OR_STALE');
  if (!POLICY.profiles.includes(profile(c.profile)) || c.intent?.service !== POLICY.lanes[profile(c.profile)]) issues.push('REGIONAL_ACCOUNT_LANE_MISMATCH');
  if (!r.region || !compact(c.keyword).includes(compact(r.region)) || compact(c.intent?.region)!==compact(r.region)
      || !r.serviceTerm || !compact(c.keyword).includes(compact(r.serviceTerm))) issues.push('REGIONAL_KEYWORD_STRUCTURE_MISSING');
  if (r.serviceAreaVerified !== true || !r.serviceAreaSource) issues.push('SERVICE_AREA_UNVERIFIED');
  if (!fresh(c.serp?.checkedAt,context.asOf,POLICY.serpMaxAgeDays)) issues.push('REGIONAL_SERP_STALE');
  if (c.serp?.intent !== 'local_service' || !c.serp?.intentReason) issues.push('LOCAL_SERVICE_INTENT_UNVERIFIED');
  if (!context.historyFingerprint || review.historyFingerprint !== context.historyFingerprint
      || !fresh(review.checkedAt,context.asOf,POLICY.reviewMaxAgeDays)) issues.push('REGIONAL_HISTORY_REVIEW_STALE');
  if (review.regionMaskedReview !== true || !review.answerComparison || !review.reviewedPostUrls?.length && !review.noRelatedPostsReason)
    issues.push('REGION_MASKED_ANSWER_REVIEW_MISSING');
  if (!r.regionIndependentAnswerKey || c.answerKey !== r.regionIndependentAnswerKey) issues.push('REGION_INDEPENDENT_ANSWER_KEY_MISSING');
  if (!r.contentBasis || !['verified_case','service_guide'].includes(r.contentBasis.type)
      || !r.contentBasis.source || !r.contentBasis.newEvidenceDescription) issues.push('REGIONAL_CONTENT_BASIS_MISSING');
  if (r.contentBasis?.type === 'verified_case' && (r.contentBasis.actualWorkConfirmed !== true
      || compact(r.contentBasis.region)!==compact(r.region))) issues.push('REGIONAL_CASE_UNVERIFIED');
  if (tier === 'EXPERIMENT') {
    if (!r.experimentHypothesis) issues.push('REGIONAL_EXPERIMENT_HYPOTHESIS_MISSING');
    const prior=(context.history || []).filter(h=>profile(h.profile||h.account)===profile(c.profile)
      && h.demandTier==='EXPERIMENT' && !(context.revisingDraftIdentity && h.draftIdentity===context.revisingDraftIdentity));
    const used=prior.filter(h=>{const date=h.publishedAt||h.reservedAt;const age=(Date.parse(context.asOf)-Date.parse(date))/864e5;return !Number.isFinite(age)||age>=0&&age<7;}).length;
    if (used>=POLICY.experimentMaxPer7Days) issues.push('REGIONAL_EXPERIMENT_WEEKLY_LIMIT');
  }
  return {issues, demandAccepted, tier, minimum, censored};
}
module.exports={POLICY,compact,profile,day,fingerprint,fresh,regionalRules};
