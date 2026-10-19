# 공동개발실

## 접근과 승인

- 소유자: `waterfallingsound0827@gmail.com`
- 공동개발자: `noritakeyuki@fuji.waseda.jp`
- 경로: `/co-development`. 홈 카드와 서버 페이지, API에서 두 계정을 검증한다. 다른 개발자 역할만으로 접근할 수 없다.
- Yuki의 기존 운영 화면은 조회 전용이다. 쓰기 예외는 `/api/co-development` 네임스페이스에만 있으며 기존 DB 쓰기 차단 마커는 유지한다.
- 검토 요청은 소유자의 검토 대기 상태만 표시한다. 저장소 커밋·병합·배포 기능은 제공하지 않는다. 소유자가 별도로 지시한 뒤 일반 검토·배포 절차를 진행한다.
- 공동개발실 안의 카드 디자인·공간 설정·시험 기능 저장은 별도의 소유자 승인 없이 가능하다. 처음 공동개발실 코드와 전용 테이블을 운영에 도입하는 작업은 기존처럼 승인이 필요하다.

## Yuki 중심 작업 공간

입장하면 지정한 첫 화면의 최신 버전부터 실행한다. 지정하지 않으면 최근 작업을 연다. 편집기와 코드·버전·검토 도구는 기본적으로 접혀 있어 소유자는 결과물을 바로 사용할 수 있다. GPT가 새로운 버전을 저장하면 ‘최신 작업 불러오기’로 다시 읽는다. 단순히 이전 iframe만 재실행하지 않는다.

‘공간 꾸미기’ 또는 GPT Actions의 `settings_get` / `settings_save`에서 다음을 변경한다.

- 홈 카드와 공간 이름, 카드 설명
- 배경·글자·강조 색상
- 카드 전체 HTML/CSS/JavaScript 디자인
- 공동개발실 첫 화면으로 사용할 저장된 시험 기능

카드 디자인은 클릭 전 시각 표현이다. 카드 전체가 공동개발실로 연결되는 고정된 링크이며 임의 외부 링크나 홈 페이지 CSS 수정은 허용하지 않는다. 카드 HTML은 별도 origin sandbox iframe, private/no-store, 네트워크 차단 CSP로 실행되어 다른 K_LINE 카드·헤더·인증을 바꾸지 못한다. 빈 `cardHtml`로 기본 카드를 복원한다. 디자인은 모바일 최소 높이 216px, 데스크톱 최소 높이 292px 안에 맞춘다. 로그인한 허용 계정에게만 HTML을 제공한다.

내부 화면은 첫 화면으로 지정한 기능의 HTML/CSS/JavaScript 전체를 자유롭게 구성한다. 단, K_LINE으로 돌아가기, 개발 도구, 공간 꾸미기, GPT 키 발급·폐기 같은 신뢰 영역은 iframe 밖에 남긴다. 운영 데이터와 키를 보호하는 이 영역까지 GPT가 대체하지는 못한다.

설정은 두 계정에 공유되고 변경자·버전별 원본을 별도 불변 기록으로 보관한다. 동시 수정 시 `SETTINGS_CONFLICT`를 반환한다. GPT는 `settings_get`의 전체 appearance와 version을 읽은 뒤 `settings_save`에 `appearance`, `expectedVersion`을 전달한다. 변경 후 두 계정 모두 새로 입장하면 같은 디자인을 본다. 이미 열린 화면은 최신 작업 버튼 또는 새로고침으로 갱신한다.

## 가능한 개발과 테스트

자체 HTML·CSS·JavaScript로 화면, 폼, 계산, 명단 가공 등의 시험 기능을 만들고 실행한다. HTML 또는 JSON 패키지를 가져오거나 개인 GPT Actions로 저장할 수 있다. 두 계정은 같은 버전과 같은 시험 데이터를 사용한다. 버전 기록은 불변이며 동시에 수정하면 충돌을 알린다. 새 버전에는 새 시험 데이터가 적용된다.

iframe은 `allow-scripts`만 허용하고 별도 origin으로 실행한다. CSP로 fetch, 외부 스크립트·리소스, 폼 전송, 하위 프레임을 제한한다. 부모 페이지의 세션·키·운영 데이터는 전달하지 않는다. 일반적인 브라우저 샌드박스이며 악의적 무한 루프의 CPU 사용까지 격리하는 서버 VM은 아니다. 시험 데이터에 개인정보나 비밀값을 넣지 않는다.

새 서버 API, 패키지 설치, 운영 데이터 접근, 기존 사이트 컴포넌트 교체가 필요한 기능은 이 HTML 실행기로 바로 배포할 수 없다. 패키지와 요구사항을 내보내 소유자의 코드 검토를 거친다.

## 시험 데이터 SDK

```js
const state = await window.KLINE_LAB.read();
const updated = await window.KLINE_LAB.save(
  { ...state.data, count: (state.data.count || 0) + 1 },
  state.version
);
```

다른 계정이 먼저 저장하면 `STATE_CONFLICT`가 반환된다. 다시 읽고 변경을 적용한다. 연결 메시지는 해당 iframe의 MessagePort에서만 처리하며 임의 API 경로나 SQL을 실행하는 브리지는 없다.

## 개인 GPT 연결

1. 공동개발실의 ‘내 GPT 연결’에서 OpenAPI 스키마를 복사한다.
2. 개인 GPT의 Actions에 스키마를 등록한다.
3. 인증은 API Key / Bearer로 설정하고 공동개발실에서 발급한 연결키를 입력한다. OpenAI API 키를 입력하는 칸이 아니다.
4. GPT에게 단일 HTML·시험 데이터로 기능을 만들고 공동개발실에 저장하도록 요청한다.

연결키는 30일 유효하며 DB에는 SHA-256 해시만 저장한다. 갱신하면 기존 키를 즉시 무효화하며 폐기도 가능하다. 키로 할 수 있는 일은 시험 기능 목록·상세 조회·저장과 공동개발실 꾸미기다. 세션 전용인 키 발급, 검토 요청, 실행 중 데이터 접근은 허용하지 않는다. 키를 등록한 GPT는 비공개로 유지한다. 키를 쓰는 모든 호출은 발급 계정의 행위로 기록된다.

스키마 서버 주소는 현재 접속 origin을 사용한다. 실제 개인 GPT에서 호출하려면 승인된 HTTPS 배포 주소가 필요하다. localhost 검증만으로 GPT 원격 연결 완료라고 보고하지 않는다. 실제 Yuki 개인 GPT 설정은 아직 수행하지 않았다.

공식 문서: https://developers.openai.com/api/docs/actions/authentication

## 본인 Codex 직접 연결

GPT Actions와 별개로 `/api/co-development/mcp`에 공식 MCP TypeScript SDK 기반 Stateless Streamable HTTP 서버를 제공한다. Codex에서 본인 계정·모델을 그대로 사용하며 K_LINE의 OpenAI API 키를 전달하지 않는다.

공동개발실의 ‘Codex 연결’에서 설정을 복사하고 전용 연결키를 발급한다. 다음은 운영 배포 후 사용하는 설정이다.

```toml
[mcp_servers.kline_lab]
url = "https://kline-nine-wheat.vercel.app/api/co-development/mcp"
bearer_token_env_var = "KLINE_LAB_TOKEN"
```

`KLINE_LAB_TOKEN`을 Codex 실행 환경에 설정한다. 원문을 config·소스·채팅에 넣지 않는다. Codex의 신뢰한 프로젝트 `.codex/config.toml` 또는 개인 설정에서 연결하고 재시작한다. 환경변수를 전달하는 방법은 Codex를 실행하는 장치/클라이언트에 따라 별도 설정해야 한다. 공식 문서: https://learn.chatgpt.com/docs/extend/mcp?surface=cli

도구: `lab_starter`, `lab_list`, `lab_get`, `lab_save_bundle`, `lab_source`, `lab_settings`, `lab_customize`, `lab_records`, `lab_save_record`.

‘개발 프로젝트 받기’는 키 없는 빈 프로젝트 ZIP을 내려준다. Yuki가 본인 Codex에서 소스 파일을 직접 수정하고 라이브러리·빌드 도구를 추가하여 개발한다. 임의의 단체 카드·회원·회비·출석 데이터는 포함하지 않는다. ECC 전체 소스 또는 완성된 복제본은 아니다.

- `npm install --ignore-scripts`, `npm run build`: 본인 컴퓨터에서 로컬 빌드한다.
- MCP `lab_save_bundle`: 빌드한 inline HTML과 여러 소스 파일을 한 번에 보관한다. 버전별 소스는 불변이며 소스 맵을 경로순으로 정렬한 JSON의 SHA-256을 기록한다. 화면과 소스 저장은 같은 DB 트랜잭션으로 처리한다.
- 또는 무시되는 `.env.local`에 URL·전용 연결키를 설정하고 `npm run sync`를 실행한다. 원격 버전이 바뀌었으면 강제로 덮어쓰지 않고 중단한다.
- 파일 수 최대 100개, 소스 JSON 총 1 MiB, inline HTML은 256 KiB. `.env`, 비밀키 파일, 경로 탈출, 포함된 `kll_` 원문 토큰을 거부한다. K_LINE 서버에서 업로드한 소스·빌드 스크립트·의존성을 실행하지 않는다.
- `lab_source`와 화면의 ‘소스 다운로드’로 실제 버전의 원본 소스를 확인할 수 있다.

### 전용 테스트 백엔드

회원·행사·회비·출석·게시판 등은 프로젝트별 이름 있는 JSON collection으로 작성할 수 있다. 이 데이터는 단순한 버전별 fixture와 달리 UI 버전이 바뀌어도 유지된다. 두 허용 계정만 조회·수정할 수 있으며 운영 ECC·한활 회원 테이블과는 별개다.

```js
const page = await window.KLINE_LAB.records.list("members", { limit: 100 });
const member = await window.KLINE_LAB.records.create("members",
  { name: "Synthetic member", paid: false, present: false });
await window.KLINE_LAB.records.save("members", member.id,
  { ...member.data, present: true }, member.version);
```

UUID 커서 페이지네이션, 레코드별 버전 충돌 감지, 불변 변경 기록, 보관·복원을 지원한다. 프로젝트당 최대 500개, 레코드 JSON 최대 16 KiB, 계정별 시간당 300회 저장. iframe에 projectId나 인증키를 제공하지 않으며 부모가 실제 실행 중인 프로젝트 ID를 강제로 지정한다. 브라우저 SDK의 요청 번호와 레코드 UUID는 서로 다른 필드로 처리한다.

새 레코드는 SDK `create`가 부모에서 UUID를 생성하도록 한다. native form 제출은 sandbox가 차단하므로 click/keydown 핸들러로 SDK를 호출한다. sandbox의 `allow-forms`나 외부 통신 권한을 풀지 않는다. 소스에 이 제약과 예제를 포함했다.

임의 SQL·서버 프로세스·셸·운영 테이블·외부 서비스 키는 MCP에 노출하지 않는다. 새 Node/Python 서버 코드는 본인 로컬에서 개발·테스트할 수 있으나 소스 업로드만으로 K_LINE 서버에서 실행되지는 않는다. 그런 런타임, 실제 Google 계정 연동, 실제 회원 가입·결제·공개 운영은 별도 격리 배포와 권한 검토가 필요하다. 공개 반영 승인 조건을 대신하지 않는다.

### Codex 연결 검증 상태

- `npm run test:co-development`: 15개. 공식 MCP SDK 클라이언트 initialize/listTools/callTool, 다중 소스 원본·해시, 데이터 저장·조회·충돌·보관·격리·RLS·권한 차단·브라우저 SDK 요청 번호 회귀 검증 포함.
- `scripts/co-development-codex-live.mjs`: localhost 전용. 실제 HTTP MCP 연결로 프로젝트·소스 7파일·시험 회원 2명 저장 후 소유자 세션에서 동일 원본과 데이터를 확인한다. 운영 주소는 거부한다.
- 브라우저 최초 검증에서 record id가 요청 id를 덮어써 타임아웃이 발생했다. SDK와 부모 메시지 매핑을 수정하고 새 로컬 서버/DB에서 전 과정을 다시 실행했다. 이후 회비·출석 저장과 다른 계정 열람이 정상 동작했다.
- 스타터의 native form 제출도 sandbox에 맞는 버튼/Enter 처리로 수정하고 다시 생성했다. 최종 화면에서 Yuki 시험 계정이 새 회원을 생성·회비·출석 변경 후 소유자 시험 계정이 동일 데이터 3건을 읽는 흐름까지 검증했다.
- 실제 Yuki 장치의 Codex 설치·키 설정·실제 계정 연결과 운영 HTTPS 환경 검증은 미완료다. SDK 규격 검증을 Yuki 본인의 Codex 연결 완료로 보고하지 않는다.

## 저장과 적용 준비

마이그레이션: `supabase/migrations/20261019073740_co_development_lab.sql`

꾸미기 추가 마이그레이션: `supabase/migrations/20261019171038_co_development_customization.sql`. `co_dev_settings`, `co_dev_settings_history`에만 저장하며 RLS·직접 접근 회수·서버 전용 security invoker RPC를 적용한다. 운영 테이블은 변경하지 않는다. 추가 마이그레이션도 운영에 미적용이다.

Codex 추가 마이그레이션: `supabase/migrations/20261019173447_co_development_codex.sql`. `co_dev_sources`, `co_dev_records`, `co_dev_record_history`에 같은 서버 전용/RLS 규칙을 적용한다. 운영에 미적용이다.

전용 테이블 `co_dev_projects`, `co_dev_revisions`, `co_dev_states`, `co_dev_tokens`만 추가한다. 모두 RLS를 활성화하고 anon/authenticated/PUBLIC 접근을 회수한다. 서버 전용 함수는 security invoker이며 기존 동아리·회원·행사 테이블에 접근하지 않는다. 최대 100개 기능, 기능별 100개 버전, 사용자당 시간당 60회 저장으로 제한한다.

운영 DB 적용·원격 저장소 반영·배포는 아직 수행하지 않았다. 승인 후 검토한 마이그레이션과 코드부터 반영하고 두 실제 계정의 Google 로그인을 검증한다.

## 검증

- `npm run test:co-development`: 15개 통과. 실제 마이그레이션을 로컬 PGlite에 실행하며 두 계정의 암호화 테스트 세션, 공유 데이터, 충돌, 토큰 해시·회전·만료·폐기, 비허용 계정과 DB 역할 차단을 검증했다. GPT 키로 카드 디자인·첫 화면을 바꾸고 소유자 계정으로 같은 설정을 읽는 경로 및 Codex MCP 도구를 포함한다.
- `node --test scripts/read-only-developer.test.mjs`: 6개 통과. 기존 운영 쓰기 제한 유지.
- `npm run check`: 기존 전체 테스트, 타입 검사, 브라우저 메타데이터 검사, 빌드, V4 격리 검사 통과.
- 브라우저: Yuki 테스트 계정으로 기능 작성·저장·실행, 데이터 추가, 부모 DOM/운영 API 접근 차단을 확인했다. 소유자 테스트 계정에서 동일 기능·데이터를 읽고 검토 요청까지 확인했다. 일반회원과 다른 개발자에게 카드는 표시되지 않았다.
- 실제 개인 GPT 원격 호출·운영 Supabase 적용·실제 두 사용자의 로그인 검증은 미수행이다.

로컬 화면: `node scripts/co-development-preview.mjs`. localhost 전용 시험 계정 선택기와 메모리 DB이며 운영 배포에 포함되는 페이지가 아니다. 서버를 종료하면 이 미리보기의 시험 데이터는 사라진다.

## 2026-10-20 배포 준비 변경

위 검증 기록의 시험 카드·회원은 localhost 메모리 DB에서만 사용했다. 운영 마이그레이션은 자료를 삽입하지 않으며 빈 공동개발실로 시작한다. 다운로드 스타터에서도 임의의 회원관리 예제를 제거했다. 기존 동아리 테이블에는 삭제·수정을 실행하지 않는다.

Next 15.5.28, next-auth 5.0.0-beta.32 (@auth/core 0.41.3), PostCSS 8.5.31로 제한적으로 보안 패치를 적용했다. npm audit 결과 critical은 3개에서 0개로 줄었고 기존 전이 의존성의 high 9개/moderate 8개는 남아 있다. 전체 의존성의 무분별한 major 업그레이드는 하지 않았으며 검사·빌드 성공을 취약점 없음으로 해석하지 않는다. 실제 반영된 커밋·DB·배포 검증은 별도 배포 기록에 남긴다.
