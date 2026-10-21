# 개발 노트

## 파일
| 파일 | 역할 |
|---|---|
| `sites.js` | 사이트 어댑터 (카드 셀렉터, ID 추출). **사이트 개편 시 여기만 수정** |
| `content.js` | 카드 장식, 모달, 상세 패널, MutationObserver |
| `content.css` | `ucf-` 접두사 스타일 |
| `popup.*` | 거른 매물 관리 |

저장: `chrome.storage.local` 의 `f:<site>:<id>` = `{site,id,reason,title,url,createdAt,updatedAt}` (브라우저 로컬, 기기 간 동기화 안 됨 → 내보내기로 백업)

## DOM 분석 (2026-10 기준)

### 엔카 `www.encar.com/dc/dc_carsearchlist.do#!{...}`
- 해시 기반 SPA(knockout). 페이지/필터 변경 시 리로드 없이 목록만 교체 → MutationObserver 로 재처리
- 목록 컨테이너: `[data-role="list_container"]`
  - `tbody#sr_special`, `tbody#sr_normal` → 행 `tr[data-impression="42851887|..."]`
  - `ul.car_list#sr_photo`, `#sr_warrant` → `li`
- **매물 ID = carid**: `data-impression` 첫 토큰, 또는 `a[href*="carid="]` 의 쿼리값
- 상세: `fem.encar.com/cars/detail/{carid}` (구 `dc_cardetailview.do?carid=`)
- `tr` 은 absolute 기준점으로 불안정 → 오버레이를 마지막 `td` 에 붙이고 폭을 tr 폭으로 맞춤(ResizeObserver)

### K Car `www.kcar.com/bc/search`
- Nuxt(Vue) SPA, 검색조건이 URL 에 없음. 카드: `div.carListBox`
- 카드 링크가 전부 `href="/bc/search"`(JS 라우팅)라 **링크로는 ID 를 얻을 수 없음**
- **매물 ID = 차량코드 `EC########`**: 카드 내부 `#timerInfoDtlEC61407955`, `#stateDlvyEC...` 의 id 에서 추출, 없으면 이미지 경로(`.../61407955_...jpg`)의 8자리
- ID 없는 `carListBox` 는 광고 슬롯 → 무시
- 상세: `/bc/detail/carInfoDtl?i_sCarCd=EC61407955`
- Vue 가 페이지 전환 시 DOM 노드를 재사용할 수 있어, 카드마다 `data-ucf-state=id|updatedAt` 로 변경 감지

## 알려진 한계 / TODO
- K Car 리스트형 보기(목록 아이콘 토글)와 상세 페이지 URL, 엔카 신규 UI(`car.encar.com`) 는 실사이트에서 미검증
- 같은 차가 엔카↔K Car 에 동시 등록돼도 ID 체계가 달라 별개로 취급 (차량번호 기반 매칭은 추후)

## 로컬 개발
`chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램을 로드** → 이 저장소 폴더.
코드 수정 후 확장 카드의 ↻ + 대상 탭 새로고침.

## 릴리스
1. `manifest.json` 의 `version` 올리기 → 커밋
2. 런타임 파일만 zip (`manifest.json sites.js content.js content.css popup.html popup.js icons/ LICENSE`)
3. GitHub Releases 에서 `vX.Y.Z` 태그로 릴리스 생성, zip 첨부
