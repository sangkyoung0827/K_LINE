# WooHyukmon Market Collector V1

사용자가 직접 연 NAVER Shopping 또는 Kakao Gift 공개 페이지를 읽어 K_LINE의 기존 Real Import Staging으로 전송하는 Manifest V3 확장 프로그램입니다. Production DB에는 직접 쓰지 않습니다.

## Build

Repository root에서:

```bash
npm run build:market-collector
```

빌드 결과는 `extensions/woo-hyukmon-market-collector/dist`에 생성됩니다.

## Chrome 개발 설치

1. `chrome://extensions`를 엽니다.
2. **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. `extensions/woo-hyukmon-market-collector/dist` 폴더를 선택합니다.
5. K_LINE 전통주 DB의 **Market Data Collection**에서 상태가 `연결됨`인지 확인합니다.

개발 중 manifest를 변경했다면 확장 프로그램 카드의 새로고침 버튼을 누릅니다.

## Permissions

- `activeTab`: 사용자가 현재 연 지원 페이지를 Popup에서 테스트할 때만 사용합니다.
- `scripting`: 사용자가 명시적으로 시작한 수집 탭에서 플랫폼 Adapter를 실행할 때만 사용합니다.
- `storage`: 사용자가 시작한 단기 Collector Job을 대상 탭 로드 전까지 보관합니다.
- `tabs`: 사용자가 시작한 Collector Job의 대상 탭을 열고 로드 완료를 확인합니다.
- Host permissions는 NAVER Shopping, Kakao Gift, K_LINE Production, localhost로 제한됩니다.
- `externally_connectable`도 K_LINE Production과 localhost만 허용합니다.

확장 프로그램에는 Supabase key, DB password, 관리자 permanent token이 없습니다. 서버가 발급한 10분짜리 Job token만 대상 탭이 로드될 때까지 확장 로컬 저장소에 보관하며, 수집 실행 시 즉시 제거합니다. 브라우저가 비정상 종료되어도 서버 만료 시각 이후에는 사용할 수 없습니다.

## Safety

- CAPTCHA, 접근 제한, 로그인 경고를 감지하면 중지합니다.
- Stealth, proxy rotation, private API reverse engineering, background unattended crawling을 구현하지 않습니다.
- 결과는 Staging → Validation → Entity Resolution → 명시적 Production Commit 흐름을 거칩니다.
