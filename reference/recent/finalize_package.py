# Source reference: inputs, images and generation evidence are excluded.
if __name__ == '__main__':
    raise SystemExit('Source reference only; do not run against original work folders.')

from pathlib import Path
import csv, hashlib, json, re, struct, subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent / 'task-2'
rows = json.loads((ROOT / 'manifests/working.json').read_text())['images']
logs = {x['key']: x for x in json.loads((ROOT / 'evidence/current-generation-log.json').read_text())}
previous = json.loads((ROOT / 'evidence/previous-generation-log.json').read_text())['images']
previous_paths = {x['savedPath'] for x in previous}
now = datetime.now(timezone.utc).isoformat()

notes2 = [
    'TV 테두리와 식탁 소품의 작은 표식을 발견해 TV·전자기기·식탁 소품 제거. 천장 자국과 가구 배치 유지.',
    'TV 하단 흰 표식을 발견해 TV 제거. 빈 바닥과 생활 가구 배치 유지.',
    '비워둔 천장 아래 공간과 가장자리 공구 상자. 공구 표면 추가 확대 확인.',
    '문과 떨어진 보호재 위 자재·공구. 공구 상자 표면 추가 확대 확인.',
    '기존 재생성본 확인. 옆방까지 따뜻한 베이지이며 푸른 벽 없음.',
    '열린 방문과 비어 있는 바닥이 통행 설명에 대응.',
    '가구와 이동 공간이 보이며 직접 가구를 미는 동작 없음.',
    '무지 책과 소품 수납함. 개인정보·책 제목·표기 없음.',
    '바닥 보호재와 경계. 들뜬 모서리나 위험 동작 없음.',
    '기존 교체본 확인. 가구를 덮은 담요·비닐이 공사 보양 설명에 대응.',
    '주방 동선과 조리대 보호재. 덮인 가전 작동이나 표시 내용 없음.',
    '기존 교체본 확인. 무지 물병·닫힌 파우치·식품 용기.',
    '생활할 방의 침구·책상과 출입문. 거주 가능을 보장하는 표기 없음.',
    '복도와 방 출입 경계가 보이는 설명 장면.',
    '기존 교체본 확인. 무지 닫힌 공구 상자·보양재·담요.',
    '보양 구역과 통로 구분. 구석의 닫힌 폐기물 봉투.',
    '보양재·수납 상자·공구 상자로 견적 포함 범위 설명. 가격표 없음.',
    '청소 도구와 폐기물 용기. 전체 청소 완료 주장을 하지 않음.',
    '천장·바닥·가구·출입문을 함께 보는 상담 사진 구도.',
    '현관에서 방으로 이어지는 길. 문 번호·주소 없음.'
]
notes3 = [
    'TV 작은 표식 제거 편집이 남아 무지 목재 테두리로 교체. 하단 확대 확인. 벽 자국과 꺼진 화면 유지.',
    '표식 제거 편집본을 제외하고 빈 바닥·TV·가구 구도를 재생성. 회색 무지 화면과 하단 확대 확인.',
    'TV 옆면과 가려진 벽 범위. 사람·손·반사 인물 없음.',
    'TV 테두리를 무지 목재로 교체하고 하단 확대 확인. 주변 벽만 보이는 정면 구도.',
    '벽지 견본과 공구 상자를 분리해 담당 범위를 설명.',
    '빈 수첩·펜·꺼진 휴대전화. 실제 일정이나 예약을 나타내는 글자 없음.',
    '각인 형태가 있던 브래킷을 무지 은색 견본으로 교체. 물건 구분용이며 설치 절차·규격 없음.',
    '표식 있는 셋톱박스를 제거. 빈 선반과 케이블 가림재 유지.',
    '무지 자료·뒤집힌 리모컨. 배경 TV까지 확대 확인, 읽을 수 있는 표기 없음.',
    'TV 표식·리모컨 문제로 구도 재생성. 무지 화면·가림재·빈 선반이 현재 배치 전달 문단에 대응.',
    '불명확한 재료 단면과 불필요한 기기를 제외하고 작은 보드·벽지 견본으로 재생성.',
    '무지 벽과 별도 브래킷 견본으로 재생성. 드릴·나사·수치·설치 방법 없음.',
    '빈 바닥과 닫힌 케이스로 보관 장소 개념. TV를 기대거나 화면을 누르는 모습 없음.',
    '부품 수납함·뒤집힌 리모컨·정돈된 케이블. 전기 작업 동작 없음.',
    '벽지 질감만 보이는 견본. 건조 완료나 고정 강도 판정 수치 없음.',
    '빈 카드·펜·벽지 견본. 날짜·확정 대기기간 없음.',
    '닫힌 케이스와 공구 가방을 원본으로 추가 확인. 글자·로고 형태 없음.',
    '기존 일반 L형 철물 대신 TV 브래킷·케이블 가림재 견본으로 재생성.',
    '무지 색 화면과 리모컨. TV 하단 확대 확인. 실제 재설치 성과나 정상 작동 증거로 사용하지 않음.',
    '기존 파일은 완료 생성 이벤트를 확인하지 못하고 작은 하단 표식도 있어 제외. 벽지·가림재·빈 선반만 새로 생성.'
]
article_info = {}
for mark, filename in [('mark2', 'mark2-occupied-ceiling.md'), ('mark3', 'mark3-tv-wallpaper.md')]:
    src = OLD / 'drafts' / filename
    text = src.read_text()
    title = text.splitlines()[0].removeprefix('# ')
    body = '\n'.join(line for line in text.splitlines()[1:] if not line.startswith('## ')).strip()
    body = body.replace(' 아래 장면은 공사 전에 확인할 항목을 설명하기 위한 예시입니다.', '')
    body = body.replace(' 아래 장면은 확인할 항목을 설명하기 위한 예시입니다.', '')
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', body) if p.strip()]
    assert len(paragraphs) == 22, (mark, len(paragraphs))
    assert body.count('CONTACT_PHONE_PLACEHOLDER') == 1
    final_md = '# ' + title + '\n\n' + '\n\n'.join(paragraphs) + '\n'
    (ROOT / 'drafts' / filename).write_text(final_md)
    final_txt = title + '\n\n' + '\n\n'.join(paragraphs) + '\n'
    (ROOT / 'drafts' / filename.replace('.md', '.txt')).write_text(final_txt)
    article_info[mark] = {
        'title': title, 'source_draft': str(src), 'source_sha256': hashlib.sha256(src.read_bytes()).hexdigest(),
        'final_draft': str(ROOT / 'drafts' / filename), 'characters_with_spaces_including_title': len(final_txt),
        'body_characters_with_spaces': len('\n\n'.join(paragraphs)), 'paragraph_count': len(paragraphs),
        'phone_occurrences': 1, 'subheadings': 0, 'automatic_captions': 0, 'automatic_ai_notice': False,
        'source_changes': '본문 9개 소제목과 도입의 예시 안내 한 문장 제거. 제목·나머지 문단·상담 전화 유지.',
        'paragraphs': paragraphs
    }

for r in rows:
    mark = 'mark' + r['id'][1]
    n = int(r['id'][3:5])
    if mark == 'mark2' and n in (1, 2):
        key = f'm2-{n:02}-final'
        r['prior_source_path'] = r['source_path']
        r['source_path'] = logs[key]['path']
        r['final_generation_key'] = key
        r['final_prompt'] = logs[key]['prompt']
    target = Path(r['source_path'])
    p = Path(r['final_path'])
    if p.is_symlink():
        p.unlink()
    else:
        assert not p.exists(), f'Will not overwrite regular file {p}'
    p.symlink_to(target)
    blob = target.read_bytes()
    r['width'], r['height'] = struct.unpack('>II', blob[16:24])
    assert r['width'] * 3 == r['height'] * 4
    r['bytes'] = len(blob)
    r['sha256'] = hashlib.sha256(blob).hexdigest()
    r['link_type'] = 'symlink; original bytes preserved'
    r['review_current'] = 'PASS_LOCAL_VISUAL_QA'
    r['review_note_current'] = (notes2 if mark == 'mark2' else notes3)[n - 1]
    r['visual_checks'] = {'single_photo': True, 'realistic_korean_home': True, 'no_people_or_hands': True,
        'no_visible_text_logo_watermark': True, 'no_sky_blue_wallpaper': True, 'matches_paragraph': True}
    r['review_method'] = '4장 단위 축소 검수 + 수정본 개별 검수 + 기기/표식 의심 영역 원본 또는 확대 확인'
    r['paragraph_id'] = f'P{n:02}'
    r['insert_after_exact_text'] = article_info[mark]['paragraphs'][n - 1]
    r['caption_to_insert'] = ''
    r['planning_caption_internal_only'] = r.get('planning_caption', r.get('caption', ''))
    r['generated_explanatory_scene'] = True
    r['real_client_evidence'] = False
    r['generation_log_confirmed'] = 'final_generation_key' in r or r['source_path'] in previous_paths
    assert r['generation_log_confirmed'], r['id']
    r['provenance'] = 'OpenAI official image_gen.imagegen; same article preparation chain'
    r['reviewed_at_utc'] = now
    # Old fields are retained only in the original task-2 records, so final readers cannot mistake them for current status.
    for key in ['review', 'review_note', 'local_path', 'caption', 'planning_caption']:
        r.pop(key, None)

assert len(rows) == 40 and len({r['sha256'] for r in rows}) == 40
for mark in ['mark2', 'mark3']:
    selected = [r for r in rows if r['id'].startswith('m' + mark[-1])]
    assert len(selected) == 20
    manifest = {'account': 'BLOG_ID_PLACEHOLDER' if mark == 'mark2' else 'BLOG_ID_PLACEHOLDER',
        'status': 'LOCAL_PREPARATION_COMPLETE_NOT_PUBLISHED', 'article': article_info[mark],
        'image_count': 20, 'images': selected, 'editor_upload_verified': False, 'published': False}
    (ROOT / 'manifests' / f'{mark}-final.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    with (ROOT / 'manifests' / f'{mark}-files.txt').open('w') as f:
        f.write('\n'.join(r['final_path'] for r in selected) + '\n')
    lines = [f'# {mark} 최종 문단 배치표', '', '내부 편집용. 본문에 표·문단 ID·검수 설명·캡션 후보를 삽입하지 않습니다.',
        '', f"제목: {article_info[mark]['title']}", '', '사진 01–20을 각각 본문 P01–P20 뒤에 한 장씩 넣습니다. P21은 업체 안내, P22는 상담 전화입니다.',
        '캡션은 빈 상태로 전달하며 AI 활용 토글도 자동 변경하지 않습니다. 모든 사진은 독립된 생성 설명 장면입니다.', '',
        '| 순서 | 삽입 문단 시작 | 최종 파일 | 내부 장면·검수 설명 |', '|---|---|---|---|']
    for r in selected:
        lines.append(f"| {r['paragraph_id']} 뒤 | {r['insert_after_exact_text'][:48]}… | [{r['filename']}]({r['final_path']}) | {r['review_note_current']} |")
    lines += ['', '정확한 문단 전체 문자열·파일 해시·생성 출처·기존 캡션 후보는 계정별 final.json을 참고합니다. 캡션 후보는 이전 계획 기록이며 자동 삽입 대상이 아닙니다.', '']
    (ROOT / f'{mark}-placement.md').write_text('\n'.join(lines))

qa = ['# 최종 사진 검수표', '', f'검수 기록: {now}', '',
      '아래 PASS는 로컬 파일의 내용·비율·문단 대응 검수입니다. 네이버 업로드, 임시저장, 공개 사진 수 검증을 뜻하지 않습니다.',
      '', '| 계정/번호 | 결과 | 크기 | 근거 및 교체 내용 | SHA-256 앞 12자리 |', '|---|---|---|---|---|']
for r in rows:
    qa.append(f"| {r['id']} | PASS | {r['width']}×{r['height']} | {r['review_note_current']} | {r['sha256'][:12]} |")
qa += ['', '공통 확인: 단일 현실적 설명 장면, 인물·손·문자·로고·워터마크·하늘색 벽지·콜라주 없음. 일반 기기의 빈 감지부·물리적 구멍·목재 무늬는 문자나 로고로 판정하지 않았습니다.',
       '원고와 배치 설명은 실제 고객 현장, 시공 전후, 업체 실적, 측정 결과로 이 이미지들을 표현하지 않습니다.',
       'review 폴더의 묶음 사진과 확대 사진은 검수 전용이며 최종 이미지 40장에 포함되지 않습니다.', '']
(ROOT / 'image-review.md').write_text('\n'.join(qa))

selected_paths = {r['source_path'] for r in rows}
exclusions = []
for r in logs.values():
    if r['path'] not in selected_paths:
        exclusions.append({'path': r['path'], 'key': r['key'], 'reason': 'TV 하단의 작은 흰 표식·명판 형태가 남아 최종 선택에서 제외', 'preserved': True})
for r in rows:
    if r.get('prior_source_path'):
        exclusions.append({'path': r['prior_source_path'], 'replaced_by': r['source_path'], 'id': r['id'], 'reason': r['review_note_current'], 'preserved': True})
(ROOT / 'manifests/excluded-and-replaced.json').write_text(json.dumps(exclusions, ensure_ascii=False, indent=2) + '\n')

summary = {'status': 'LOCAL_PREPARATION_COMPLETE', 'published_count': 0, 'uploaded_count': 0,
           'final_counts': {'mark2': 20, 'mark3': 20}, 'unique_sha256': 40,
           'all_exact_4_3': True, 'dimensions': sorted({f"{r['width']}x{r['height']}" for r in rows}),
           'symlinks': 40, 'original_images_bulk_copied': 0, 'existing_selected': 28,
           'new_selected': 12, 'current_imagegen_outputs': 18, 'current_rejected_outputs': 6,
           'original_generation_files_preserved': len(list((OLD / 'generated_images').glob('*.png'))),
           'prior_generation_events_confirmed': len(previous),
           'original_mark3_20_event_confirmed': False,
           'article_counts': {k: {x: v[x] for x in ['characters_with_spaces_including_title', 'body_characters_with_spaces', 'paragraph_count', 'phone_occurrences']} for k, v in article_info.items()},
           'not_attempted': ['login', 'authentication_retry', 'editor_upload', 'temporary_save', 'publish', 'site_change'],
           'remaining_online_steps': ['사용자 직접 로그인 완료', '임시저장·예약 중복 확인', '업로드 20장 완전 로딩과 원고 대조', '명시된 후속 범위에서 발행·공개 URL 재검증']}
(ROOT / 'manifests/final-check.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')

# Rebuild small review sheets after the final two mark2 replacements.
for prefix in ['m2', 'm3']:
    selected = [r for r in rows if r['id'].startswith(prefix)]
    for start in range(0, 20, 4):
        cmd = ['magick', 'montage', '-font', '/System/Library/Fonts/Helvetica.ttc', '-pointsize', '18']
        for r in selected[start:start+4]:
            cmd += ['-label', r['id'], r['final_path']]
        cmd += ['-thumbnail', '480x360', '-tile', '2x2', '-geometry', '480x390+8+8', '-background', '#eeeeee',
                '-quality', '85', str(ROOT / 'review' / f'{prefix}-{start+1:02}-{start+4:02}-final.jpg')]
        subprocess.run(cmd, check=True, capture_output=True)
print(json.dumps(summary, ensure_ascii=False, indent=2))
