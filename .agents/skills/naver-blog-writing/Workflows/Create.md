# Create

## Step 0 — Sufficiency Check

The deliverable is a new temporary-saved Naver blog draft. The profile, topic direction, keyword evidence, fresh AI and optional real-photo image set, article body, and save target must be identifiable before the editor is opened. If the profile is omitted, use the configured default batch. If a supplied keyword conflicts with the profile’s hard policy, let preflight reject it instead of silently changing the account’s positioning.

For Mark3, read the project’s `MARK_IMAGE_FRESHNESS_WORKFLOW.md` before running the pipeline.

## Ideal State

The workflow closes with one result per requested profile:

- a Naver SearchAd exact-demand and Naver Blog/VIEW preflight report with a selected regional STANDARD or EXPERIMENT candidate;
- a related-question report used only for the title tail and opening angle;
- a per-post image manifest with fresh AI images and optional privacy-cleared unused field photos, expected paths, SHA/provenance validation, and no reused images;
- a profile-specific article meeting the selected text/image baseline and the configured AI-image/evidence policy;
- bounded editor QA, account-isolated login, and a verified temporary save;
- no publish, schedule, credential output, or gate bypass.

## Regional keyword selection (current route, 2026-09-27)

Default accounts are mark1, mark2, mark3, mark5, processed by a single agent sequentially.
Read `<project_root>/REGIONAL_KEYWORD_WORKFLOW.md` before selecting a new topic.
Refresh public, saved-draft, in-progress and scheduled history; review the regional candidate queue against all four accounts.

```bash
node "<project_root>/scripts/regional_keyword_planner.cjs" "<reviewed-input.json>" "<selection-plan.json>"
```

The same planner is available through `scripts/blog_four_week_strategy.ts --regional-plan INPUT OUTPUT`.
It only selects local keyword slots. READY requires seven primary and seven reserve candidates per account.
An individual PLANNED slot can proceed after same-day revalidation even when other slots NEEDS_RESEARCH.
No candidate passing the gates means report the shortage and expand research; never invent demand, field evidence or semantic review.
`<10` exact results are permitted only in the bounded regional experiment lane described in the project workflow.
Images, content, privacy and editor QA requirements remain unchanged.

The old `--execute --profile all`, `--keywords`, and `--topic` flags are not implemented by the reconstructed revision scripts. Do not call those scripts as an automatic new-post pipeline. The writer currently handles reviewed existing-draft revisions; follow the inspected current writer contract for saving and do not claim end-to-end new draft support from the planner.

## Execute

### Field-photo intake

Real photos have no minimum count. When suitable unused field photos are unavailable, fill the planned image roles with fresh Codex imagegen images, including an all-AI set. Preserve internal provenance and visual QA. Follow the 2026-09-28 user presentation preference in SKILL.md: no automatic image captions or AI toggle changes; the user manages them. Photo intake must not block drafting solely because real photos are scarce.

When field-photo intake is needed, use Computer Use only on KakaoTalk room `<사용자가 허용한 현장 사진 채팅방>`:

1. Open `채팅방 서랍 → 사진/동영상` and choose one newest unused photo group.
2. Use `대화 보기` to identify only capture date, broad region, an anonymous site label, and one stage: `damage_overview`, `damage_closeup`, `demolition`, `restoration_process`, or `completed`.
3. Never persist chat text, participant names, phone numbers, exact addresses, unit numbers, or insurance documents. If the group cannot be matched confidently, skip it.
4. Download that group and move only the files downloaded in the current action to `<project_root>/private/kakao-field-photos/raw/`.
5. Import it with:

```bash
bun "<project_root>/scripts/kakao_field_photo_pipeline.ts" import \
  --region "<broad region>" \
  --safe-site-label "<anonymous label>" \
  --stage "<stage>" \
  --captured-at "<YYYY-MM-DD>" \
  --actual-work-confirmed
```

The importer strips EXIF/GPS, rejects duplicates, and quarantines faces, phone numbers, plates, addresses, and text-heavy screenshots. Do not bypass quarantine. This is an on-demand Codex workflow, not a background KakaoTalk scraper.

After selecting a valid regional slot, perform image intake, fresh image creation, writing and editor validation using the current project contracts. Report keyword selection, local writing, editor temporary save and publishing as distinct states. This workflow never publishes or schedules by default.

## Failure Contract

If a regional slot has no eligible candidate, leave it unfilled with its recorded reasons. If image provenance, risk, login or editor QA fails, leave the article unsaved and report that concrete failure. Do not reuse an old plan/image or bypass a gate to meet the daily target.

## 자동 삽입 전면 금지 — 2026-09-28 사용자 최종 지시

- 본문 어디에도 AI 이미지 안내문·면책문을 자동 삽입하지 않는다. 예: “이 글의 이미지는 이해를 돕기 위해 AI로 제작한 예시이며 실제 고객 현장이나 측정 결과가 아닙니다.”
- 사진 아래 설명·캡션·“AI 설명용 이미지” 자동 삽입 금지. 사용자가 직접 작성한다.
- 참고문헌·출처 안내·검토용 링크를 독자용 본문에 자동 삽입하지 않는다. 내부 근거 기록에만 보관한다.
- 네이버 AI 활용 토글은 자동으로 켜거나 끄지 않는다. 사용자가 직접 관리하며, 이미지 출처로 토글 상태를 추정하지 않는다.
- 생성 이미지와 실사진의 구분·출처·해시는 내부에 정확히 유지한다. 혼합 글을 전체 AI 또는 전체 실사진으로 단정하지 않는다.
- `scripts/lib/blog_presentation_policy.cjs` 검사를 저장 전에 통과시킨다. 금지 문구·자동 캡션이 있으면 본문을 수정하고 다시 검사한다.

## 독자 관점 최종 검수 — 2026-09-28

작성자에게 필요한 지침(예시·실사 구분, 수치 생성 금지, 내부 검증·선정 규칙)을 독자에게 말하는 문장으로 옮기지 않는다. 글자 수나 금지어 검사만 통과했다고 작성 완료로 판단하지 않는다.

1. 제목부터 상담 안내까지 모든 문단을 직접 읽고 제목 질문에 답하는지 확인한다.
2. 독자에게 불필요한 면책·부정문·훈계, 실제 행동으로 이어지지 않는 추상적 설명, 반복되는 문장을 찾는다. 필요한 내용은 구체적인 확인 항목·준비 방법·선택 기준으로 고친다.
3. 금지한 AI 안내·캡션·참고문헌·내부 작성 지침이 남았는지 본문 전체를 검사한다.
4. 실제 편집 화면에서 상단·중간·하단과 수정 구간을 보고 사진 배치와 문단 가독성을 확인한다.
5. 임시저장 후 다시 열어 수정된 본문 전체와 이미지 순서를 대조한다. 사용자가 설정한 사진·캡션·AI 토글은 임의로 바꾸지 않는다.
6. 검수 기록에는 검토한 글과 수정 문단, 실제 화면 확인·재열기 결과를 남긴다. 위 지침 자체는 블로그 본문에 쓰지 않는다.

## 모든 계정 본문 형식 — 2026-09-28 최종 변경

마크1·2·3·5 모두 본문에 태그·해시태그 줄과 소제목을 넣지 않는다. 글의 메인 제목은 유지하고 본문은 사진과 자연스럽게 이어지는 문단으로만 구성한다. 소제목을 일반 문장처럼 남겨서 우회하지 않는다. 태그가 필요하면 발행 단계의 별도 태그 입력란에만 사용하며 본문에 붙이지 않는다. 과거의 소제목·태그 푸터 필수 조건보다 이 규칙이 우선한다.
