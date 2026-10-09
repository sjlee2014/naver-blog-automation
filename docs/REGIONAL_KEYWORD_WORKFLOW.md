# 네 계정 지역 키워드 운영 규칙

적용: 2026-09-27, regional-v1. 목표는 마크1·2·3·5 각각 매일 한 편의 **검증된 작성 주제 준비**다. 발행 횟수를 맞추기 위한 중복·미확인 자료 통과는 없다. 예약/발행은 별도 단계다.

## 계정 역할

| 계정 | 서비스 lane | 우선 질문 |
|---|---|---|
| 마크1 | leak_detection | 해당 지역에서 누수 원인 확인·탐지를 의뢰하는 문제 |
| 마크2 | carpentry_restoration | 석고보드·천장·문틀·몰딩 등 실제 목공 복구 |
| 마크3 | wallpaper_restoration | 누수 후 도배와 마감 선택·하자 판단 |
| 마크5 | restoration_contract | 복구 공사 의뢰·업체 선택·견적·공정 인계 |

기존 60일 의도 소유권이 역할표보다 우선한다. 대표 지역은 14개로 탐색을 시작하되 고정 담당 지역을 영구 배정하지 않는다. 같은 지역이어도 다른 실제 서비스 질문이면 가능하며 같은 답에 지역명만 바꾸면 차단한다. 최초 탐색 지역은 사용자 제공 지역 목록에서 가져온 것으로 방문 가능 확인을 대신하지 않는다.

## 키워드 표기

2026-09-27 사용자 지시: 대표 키워드는 제목·본문·썸네일·태그에서 지역+서비스를 붙여 쓴다. 예: 하남누수도배, 용산누수탐지. 제목 후반의 설명 문장은 일반 띄어쓰기를 유지한다. 검색 근거의 원문·공개 글 제목은 바꾸지 않는다.

## 매일의 순서

1. 한국시간 기준 날짜와 공개 URL·실제 발행일을 갱신한다. 네 계정의 임시저장·예약·작성 중 주제도 history에 넣는다. 초안은 publishedAt을 만들지 않고 draftIdentity/reservedAt을 사용한다. 보류·폐기 초안은 일일 점유 여부를 해제하되 의미 중복 검토에는 남긴다.
2. 기존 PLANNED는 오늘의 실제 상태와 대조한다. 이미 발행/예약된 계정·날짜는 ALREADY_OCCUPIED로 건너뛴다. 같은 작업을 다시 실행해도 같은 입력이면 같은 결과가 나온다. 수정 중인 동일 초안만 revisingDraftIdentity로 예외 처리할 수 있다.
3. 계정별 다음 7일 선정표와 서로 충돌하지 않는 예비 7개를 목표로 채운다. 14개는 승인 목표이며 탐색 14개만 만들었다고 완료가 아니다.
4. 부족분은 같은 지역의 인접 서비스 질문 → 다른 손상 대상 → 실제 서비스 가능한 다른 시·구 → 근거가 있는 동·현장 순서로 탐색한다. 제목을 길게 만드는 것은 탐색 확대가 아니다. 지역+서비스를 대표어로 두고 작업 특징은 제목 후반에서 설명한다.
5. 검색광고 exact PC/모바일 원값·확인 날짜·조회 문자열을 보존한다. 통합검색에서 지역 업체 탐색 의도, 관련 블로그 URL, 검색면·확인 시점을 기록한다. 광고 경쟁도를 자연검색 난이도로 사용하지 않는다.
6. 네 계정 전체를 대조하고 지역명을 지운 뒤 고객 질문·답·자료가 기존 글과 다른지 직접 확인한다. 제목 목록만으로 검토 완료를 표시하지 않는다. historyFingerprint가 바뀌면 새 글을 포함해 재검토한다. 오래된 글에 의도키가 없는 경우 본문 비교가 필수다.
7. 일반 후보를 먼저 정렬하고 부족하면 한도 내 소수요 실험 후보를 사용한다. 부족 슬롯은 NEEDS_RESEARCH와 탈락 사유를 남긴다. 선정 결과는 순위·조회수 보장이 아니다.
8. 작성 시작 당일 다시 검사한다. 단일 에이전트가 계정별 순차 작성하며 현장 사진·이미지·본문·임시저장 QA는 기존 기준을 따른다. 이 선정기는 이미지 생성·편집기 저장·발행을 수행하지 않는다.

## 수요 구간과 유효기간

- STANDARD: 확인된 PC+모바일 최소 합계 30 이상.
- EXPERIMENT: 정확 숫자 합계 1~29 또는 `<10`이 포함되어 최소 합계가 30 미만인 지역 후보. PC와 모바일 모두 `<10`도 허용하되 수요 확인 한계를 유지한다.
- 양쪽 명시적 0, 조회 실패, exact 행 없음은 실험으로도 허용하지 않는다.
- 실험은 계정별 최근 7일 최대 2편. 시뮬레이션에서 이미 배정한 글과 실제 이력도 합산한다. 초기 운영 가설이며 성과 보장 비율이 아니다. 네 계정 모두 소수요 후보뿐이면 매일 4편을 채울 수 없다는 사실을 보고한다.
- demand 30일, SERP 7일, 의미 중복 검토 7일. 미래 날짜의 근거는 거부한다. 주간 후반에 만료되는 후보는 그 날짜 전에 다시 조사해야 한다.
- 같은 계정 7일 동일 키워드, 다른 계정 60일 동일 의도, 기간과 무관한 동일 답변 제한을 유지한다. 미래 예약과 날짜 미확인 이력도 회피 수단이 아니다.

## 근거 필드

기존 preflight 필드를 유지하고 regional 객체를 추가한다. regional이 있거나 context.selectionMode=regional_daily이면 지역 규칙을 적용한다.

- demand.source: naver_searchad_exact
- intent.service: 위 lane, intent.region: 실제 대표 지역
- serp.intent: local_service, intentReason: 결과에서 읽은 검색 의도
- regional.region, serviceTerm, serviceAreaVerified, serviceAreaSource
- regional.regionIndependentAnswerKey: 지역명과 무관한 답변 식별자. answerKey와 일치해야 한다.
- regional.contentBasis: type(service_guide 또는 verified_case), source, newEvidenceDescription. verified_case는 actualWorkConfirmed=true와 일치 지역도 필요하다. 확인 안 된 현장을 지역 시공 사례로 표현하지 않는다.
- duplicateReview: 기존 필드 + historyFingerprint, regionMaskedReview=true, answerComparison. 관련 공개 URL을 기록하며 없으면 noRelatedPostsReason을 적는다.
- 소수요 실험: regional.experimentHypothesis. 예: 지역에서 복구업체를 찾는 문의가 발생하는지 확인.

이 검사는 입력 근거의 완결성을 확인한다. 사람이 사실과 다른 검토 내용을 입력하면 의미 중복이나 현장 사실을 자동으로 알아내는 모델이 아니다. 지역을 지운 본문 비교를 별도로 수행해야 한다.

## 실행

```bash
node scripts/prepare_regional_queue.cjs INDEX.json DEMAND.json NEW_QUEUE.json AS_OF START_DATE
npm run keyword:regional-plan -- QUEUE.json PLAN.json
# 기존 전략 진입점에서도 지원
node scripts/blog_four_week_strategy.ts --regional-plan QUEUE.json PLAN.json
npm run test:regional-keywords
```

AS_OF는 시간대가 포함된 ISO 시각, START_DATE는 YYYY-MM-DD. seed는 기존 파일을 덮어쓰지 않는다. 56개 탐색 seed를 만들며 검토 완료값을 자동 생성하지 않는다. 출력 0=선정7+예비7 충족, 2=조사 부족, 1=입력 오류. PLAN은 로컬 계획일 뿐 네이버 예약이 아니다. 지속 사용 시 승인한 reservation을 다음 입력 history에 병합하고, 발행 확인 시 같은 draftIdentity를 실제 공개 URL과 발행일로 교체한다. 임의로 새 계획이 기존 예약을 덮어쓰지 않는다.

## 14일 평가

실험과 일반 후보를 구분해 공개 URL별 발행 후 동일한 7일·14일 검색 유입·조회·확인 가능한 공사 문의를 기록한다. 출처 미상 문의는 귀속시키지 않는다. 키워드 exact 수치와 별개로 실제 유입 검색어를 보존한다. 준비율, 탈락 사유, 예비 부족량도 함께 본다. 충분한 관찰 없이 실험 한도를 늘리거나 지역 글이 더 잘된다고 확정하지 않는다.
