---
name: naver-blog-writing
version: 1.0.0
user-invocable: true
argument-hint: "[mark1|mark2|mark3|mark5|all]"
description: Run the configured Naver blog post workflow from keyword selection through KakaoTalk field-photo intake, fresh AI supplements, writing, and temporary save. USE WHEN the principal asks to write a blog post, says 글 작성해줘, 글 써줘, 블로그 글 작성, or asks for keyword selection plus images and draft save. NOT FOR publishing an existing draft, scheduled publishing, or neighbor automation.
---

# _NAVERBLOGPOST

An agent instruction entry point for the configured Naver blog writing pipeline.

## Slash Command

Invoke directly with `/_NAVERBLOGPOST [mark1|mark2|mark3|mark5|all]`.

- No argument: run one daily draft slot for each of `mark1`, `mark2`, `mark3`, and `mark5` sequentially.
- `mark1`, `mark2`, `mark3`, or `mark5`: run only today’s slot for that account.
- Add candidate keywords or a topic after the profile when needed.

## Workflow Routing

| Workflow | Trigger | File |
|---|---|---|
| **Create** | 글 작성해줘, 글 써줘, 블로그 글 작성, keyword plus images plus draft save | `Workflows/Create.md` |

## Examples

**Example 1: Default daily batch**

```text
User: "글 작성해줘"
→ Invokes Create
→ Runs one keyword→unused field photos plus fresh AI supplements→writing→temporary-save pipeline for each configured default account
```

**Example 2: One account and a candidate lane**

```text
User: "마크3 글 작성해줘. 누수도배 쪽으로 찾아봐"
→ Invokes Create with the Mark3 profile and the supplied candidates as preflight input
→ Saves only after common preflight, real-photo privacy/hash checks, AI provenance, risk checks, and bounded editor QA pass
```

## Gotchas

- The default is temporary save. This workflow never schedules or publishes.
- Each account receives one daily draft slot. For keyword selection read `<project_root>/REGIONAL_KEYWORD_WORKFLOW.md` and run the regional planner. NEEDS_RESEARCH leaves the slot unfilled; do not invoke a legacy fallback to bypass it. The keyword planner does not write or save articles.
- Existing daily completion skips that account unless the current user explicitly requests an additional draft; then record the instruction with `--user-directed-daily-override`.
- Real photos have no minimum count; use fresh Codex imagegen images for any shortfall. Every real photo must be privacy-cleared and unused; every AI image must be fresh for the current manifest with valid provenance. Old images are not a fallback.
- If Mark3 is included, load the project’s `MARK_IMAGE_FRESHNESS_WORKFLOW.md` before execution.

## User presentation preference (2026-09-28)

- Do not automatically write image captions, including “AI 설명용 이미지”. The user writes captions.
- Do not automatically enable Naver AI 활용 toggles; the user manages those settings. For the 2026-09-28 four drafts, the user explicitly requested removing existing captions and disabling the toggles.
- Keep research references and source URLs in internal drafting/evidence records, not as a 참고/참고문헌 block in the blog body.
- Preserve truthful image provenance internally; these presentation preferences do not turn generated images into actual field evidence.

## Configuration

계정 ID, 연락처, 로그인 및 브라우저 설정은 저장소 밖의 사용자 로컬 설정에서 별도로 제공한다. 이 전달 사본에는 포함하지 않는다.

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
