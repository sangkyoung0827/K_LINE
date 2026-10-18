# K_LINE Google Forms 연동 개인정보 안내 (검토용 초안)

상태: 미승인·미공개. 이 문서는 법률 검토나 서비스 전체 개인정보처리방침을 대신하지 않습니다.
작성일: 2026-10-18. 시행일·보관기간·처리자 정보는 아래 확인 사항 승인 후 확정합니다.

## 서비스와 처리 목적

K_LINE의 행사 관리 기능은 관리자가 승인한 행사 신청폼과 공지 초안을 만들고,
Google Forms의 응답을 동기화하여 신청자 확인, 정원·마감 관리 및 조 편성을 돕습니다.
기존 동아리 가입·회비·회원 승인 시스템과는 별도 기능입니다.

## 접근하는 Google 정보

- 연결 운영 계정: Google 계정 식별 정보와 확인된 이메일 주소.
- 폼: 제목, 설명, 질문, 선택지, 응답 링크, 공개·접수 상태.
- 응답: Google 응답 ID, 제출 시각, 작성한 답변. 기존 폼에서 이메일을 수집한다면 해당 이메일도 포함됩니다.
- Drive: 앱에서 만들거나 사용자가 앱과 공유한 파일에 대한 제한된 접근. 모든 Drive 파일을 포괄적으로 읽는 권한은 요청하지 않습니다.
- 연결 유지: 암호화한 OAuth refresh token과 승인된 권한 목록. Google 비밀번호는 저장하지 않습니다.

행사 엔진이 새로 생성하는 기본 질문에는 이메일·학번·전화번호 등을 자동 추가하지 않습니다.
기존 폼과 관리자가 직접 수정한 폼의 수집 항목은 다를 수 있으므로 각 폼 안내를 확인해 주세요.

## 저장과 열람

Google 원본 폼·응답은 연결된 운영 계정의 Google 서비스에 남습니다.
K_LINE 서버는 폼 등록 정보 및 응답 사본을 Supabase에 저장합니다.
응답은 해당 단체의 권한 있는 관리자와 기존 시스템 권한을 가진 운영자만 열람할 수 있습니다.
로그인하지 않은 방문자나 다른 단체 관리자에게 관리용 응답 목록을 공개하지 않습니다.
브라우저에서 사용하는 일반 DB 역할에는 OAuth 토큰과 응답 테이블의 직접 접근을 허용하지 않습니다.

정원을 넘거나 마감 이후에 제출된 응답은 원본을 삭제하지 않고 별도 대기·마감 후 응답으로 구분합니다.
조 편성에는 현재 동기화된 접수 대상 명단만 사용합니다.

## 외부 서비스 및 AI

Google은 인증·폼·Drive 기능을, Supabase는 서버 데이터 저장을, Vercel은 웹 서비스 실행을 제공합니다.
우혁몬의 행사 기획·공지 작성에는 OpenAI API가 사용됩니다.
관리자가 우혁몬에 권한 있는 응답 자료를 조회·요약하도록 요청하면 필요한 자료 일부가 AI 처리 대상으로 포함될 수 있습니다.
폼 응답의 주기적인 동기화·정원 분류 자체는 AI 호출 없이 처리합니다.

게시 전, 실제 전송 필드·처리 지역·위탁/국외 이전에 필요한 고지 및 동의 절차를 운영자가 확인해야 합니다.
광고, 판매, 범용 모델 학습 등 본 문서에서 승인하지 않은 목적의 Google 데이터 사용은 허용하지 않는 정책을 제안합니다.
이 약속을 공개하기 전 실제 처리자 계약·서비스 설정과 일치하는지 확인해야 합니다.

## 보관·삭제·연결 해제

현재 행사 목록의 ‘삭제’는 목록에서 숨기는 보관 처리이며 Google 원본이나 응답을 영구 삭제하지 않습니다.
Google 계정의 연결된 앱 관리에서 접근을 철회할 수 있으며, 철회 이후 자동 생성·동기화가 중단됩니다.
접근 철회만으로 이미 저장된 Google 원본이나 K_LINE 사본이 자동 삭제되지는 않습니다.
열람·정정·삭제·연결 해제 요청은 승인될 운영 연락처로 접수하고, 요청자의 권한과 해당 자료를 확인하여 처리합니다.
현재 자동 영구 삭제나 법정 보관기간별 자동 삭제가 구현되어 있다고 안내하지 않습니다.

## 게시 전 운영자 확인 필수

1. 서비스 운영 주체와 개인정보 담당자 성명/명칭.
2. 공개 문의 이메일: 현재 Google Cloud 지원 이메일을 사용할지 확인.
3. 행사 종료 후 응답 사본·Google 원본·백업 각각의 보관기간과 실제 삭제 절차.
4. Google·Supabase·Vercel·OpenAI의 실제 계약, 처리 지역 및 필요한 국외 이전 고지.
5. 응답자에 대한 안내·동의와 관리자 AI 조회 시 데이터 최소화 기준.
6. 아동 이용, 민감정보 및 회원 탈퇴 처리 등 전체 K_LINE 방침과의 정합성.
7. 승인된 시행일, 공개 개인정보처리방침 URL, 영어본의 동일성 검토.

## English Review Summary

This is an unpublished draft, not an approved privacy policy. K_LINE uses an authorized
operations Google account to create event forms, synchronize submitted answers, manage
capacity/deadlines and prepare team lists. Google originals remain in Google; K_LINE
stores a server-side copy in Supabase. OAuth refresh tokens are encrypted. Authorized
club administrators and existing permitted operators can access management records.
Excess and late answers are retained separately rather than deleted. Archiving an event
does not permanently delete its original form or responses. Revoking Google access stops
future integration but does not erase previously stored copies. Event planning uses
OpenAI; administrator-requested AI summaries may include relevant authorized data.
The operator must approve the identity/contact, retention/deletion rules, processors,
international transfers, consent and effective date before publication. A complete
English policy must match the approved Korean version before public release.

## 검토 근거

- 실제 코드: `googleApi.ts`, `access.ts`, `club-catalog.ts`, `automationPolicy.ts` 및 private DB grants.
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [Google OAuth brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [Google refresh token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)

브랜딩/정책 URL의 누락은 현재 콘솔에서 관찰된 상태입니다. 정책 URL만 추가하면
검수나 도메인 확인 없이 운영 전환이 보장된다는 뜻은 아닙니다.
