import "server-only";
import type { AssistantScope } from "./club-access";

type Module = Record<string, unknown>;
export type Capability = { scope: AssistantScope; path: string; methods: string[]; description: string; load: () => Promise<Module>; defaults?: Record<string, string>; readMethod?: string };

// Closed registry: no user/model-provided URLs, imports, SQL, filesystem or shell.
export const clubCapabilities: Record<string, Capability> = {
  ecc_members: { scope: "ecc", path: "/api/ecc/member-registrations", methods: ["GET", "PATCH"], description: '전체 가입자·회비·정식회원. GET query {q, payment:paid/unpaid, membership:official/pending, nationality,gender} 문자열 조건. PATCH {registrations:[{id,paymentConfirmed,adminNote}]} 기존 승인 로직을 유지한다.', load: () => import("@/app/api/ecc/member-registrations/route") },
  ecc_roles: { scope: "ecc", path: "/api/ecc/roles", methods: ["GET", "PATCH"], description: '권한. PATCH {action,email}. action=approve_official_member/revoke_official_member/approve_admin/revoke_admin/approve_super_admin/revoke_super_admin. 상위 권한은 원래 API가 재검사한다.', load: () => import("@/app/api/ecc/roles/route") },
  ecc_activities: { scope: "ecc", path: "/api/ecc/activity-catalog", methods: ["GET", "POST", "PATCH", "DELETE"], description: '활동 CRUD. POST/PATCH {id,titleKo,titleEn,descriptionKo,descriptionEn}. DELETE query id. 새 활동은 닫힌 상태.', load: () => import("@/app/api/ecc/activity-catalog/route") },
  ecc_applicants: { scope: "ecc", path: "/api/ecc/applications", methods: ["GET", "PATCH", "DELETE"], description: '활동 신청자 조회·활동비. PATCH {payments:{신청id:boolean}}. DELETE query type는 활동id이며 해당 명단 초기화(명시 확인 필요).', load: () => import("@/app/api/ecc/applications/route") },
  ecc_statuses: { scope: "ecc", path: "/api/ecc/activity-statuses", methods: ["GET", "PATCH"], description: '신청 열기/닫기·활동비 필요·Gathering 요일. PATCH {activityId,isOpen,requiresPayment} 또는 {gatheringOpenDays:[monday,wednesday]}.', load: () => import("@/app/api/ecc/activity-statuses/route") },
  ecc_settings: { scope: "ecc", path: "/api/ecc/operations", methods: ["GET", "PATCH"], description: '학기·채팅 설정. PATCH {periodLabel,inquiryChatUrl,newMemberOpenChatUrl,officialTeamChatUrl}.', load: () => import("@/app/api/ecc/operations/route") },
  ecc_registration_content: { scope: "ecc", path: "/api/ecc/registration-content", methods: ["GET", "PATCH"], description: '가입 신청폼 설명·회비 안내 문구 편집. 기존 GET 데이터 형식을 유지해서 수정한다.', load: () => import("@/app/api/ecc/registration-content/route") },
  ecc_fund: { scope: "ecc", path: "/api/ecc/fund", methods: ["GET", "PATCH"], description: '자금관리 설정/기록. 실제 송금 도구 아님. 슈퍼관리자 제한은 기존 API 유지.', load: () => import("@/app/api/ecc/fund/route") },
  ecc_resources: { scope: "ecc", path: "/api/ecc/resources", methods: ["GET"], description: '통합자료실 자료 목록·카테고리 검색. 파일 업로드는 원본 업로드 화면을 사용한다.', load: () => import("@/app/api/ecc/resources/route") },
  ecc_resource: { scope: "ecc", path: "/api/ecc/resources/:id", methods: ["GET", "PATCH", "DELETE"], description: '자료 제목·본문·카테고리·태그 수정 및 삭제. PATCH 기존 자료 데이터 필드 사용.', load: () => import("@/app/api/ecc/resources/[id]/route") },
  ecc_resource_publish: { scope: "ecc", path: "/api/ecc/resources/:id/publish", methods: ["POST"], description: '통합자료실 자료 공개 승인.', load: () => import("@/app/api/ecc/resources/[id]/publish/route") },
  ecc_alumni_notices: { scope: "ecc", path: "/api/ecc-alumni/notices", methods: ["GET", "POST", "PATCH", "DELETE"], description: 'Alumni 공지 CRUD. 기존 필드 형식으로 title/content 등을 입력.', load: () => import("@/app/api/ecc-alumni/notices/route") },
  ecc_alumni_inquiries: { scope: "ecc", path: "/api/ecc-alumni/inquiries", methods: ["GET", "PATCH"], description: 'Alumni 문의 조회·관리자 답변.', load: () => import("@/app/api/ecc-alumni/inquiries/route") },
  ecc_alumni_rejoin: { scope: "ecc", path: "/api/ecc-alumni/rejoin-requests", methods: ["GET", "PATCH"], description: 'Alumni 재가입 신청 조회·승인.', load: () => import("@/app/api/ecc-alumni/rejoin-requests/route") },
  hanhwal_members: { scope: "hanhwal", path: "/api/hanhwal/member-registrations", methods: ["GET", "PATCH"], description: '한활 전체 가입자·회비·정식회원. GET query {q,payment:paid/unpaid,membership:official/pending,nationality,gender}. PATCH {registrations:[{id,paymentConfirmed,adminNote}]} 원래 승인 로직 유지.', load: () => import("@/app/api/hanhwal/member-registrations/route") },
  hanhwal_roles: { scope: "hanhwal", path: "/api/hanhwal/roles", methods: ["GET", "PATCH"], description: '한활 권한. PATCH {action,email}, 승인/해제 action은 ECC 권한 도구와 동일. 기존 상위 권한 검사 유지.', load: () => import("@/app/api/hanhwal/roles/route") },
  hanhwal_activities: { scope: "hanhwal", path: "/api/hanhwal/structured-activities", methods: ["GET", "POST", "PATCH"], description: '한활 구조화 활동·신청 회차 생성/편집. 먼저 GET으로 기존 데이터 형식과 ids 확인.', load: () => import("@/app/api/hanhwal/structured-activities/route") },
  hanhwal_submissions: { scope: "hanhwal", path: "/api/hanhwal/structured-submissions", methods: ["PATCH"], description: '구조화 신청 수정·출석 확인. 먼저 활동 GET으로 submission ids와 필드 확인.', load: () => import("@/app/api/hanhwal/structured-submissions/route") },
  hanhwal_applicants: { scope: "hanhwal", path: "/api/hanhwal/applications", methods: ["GET", "PATCH", "DELETE"], description: '한활 활동 신청자·활동비. PATCH {payments:{신청id:boolean}}. DELETE query type, 명단 초기화 명시 확인.', load: () => import("@/app/api/hanhwal/applications/route") },
  hanhwal_statuses: { scope: "hanhwal", path: "/api/hanhwal/activity-statuses", methods: ["GET", "PATCH"], description: '한활 모집 열기/닫기·활동비. PATCH {activityId,isOpen,requiresPayment}.', load: () => import("@/app/api/hanhwal/activity-statuses/route") },
  hanhwal_settings: { scope: "hanhwal", path: "/api/hanhwal/operations", methods: ["GET", "PATCH"], description: '한활 학기·팀채팅 설정 {periodLabel,officialTeamChatUrl}.', load: () => import("@/app/api/hanhwal/operations/route") },
  hanhwal_about: { scope: "hanhwal", path: "/api/hanhwal/introduction", methods: ["GET", "PATCH"], description: 'About Hanwhal 설명. PATCH {titleKo,titleEn,bodyKo,bodyEn}, 네 필드 유지.', load: () => import("@/app/api/hanhwal/introduction/route") },
  hanhwal_posts: { scope: "hanhwal", path: "/api/hanhwal/posts", methods: ["GET", "POST", "DELETE"], description: '한활 게시글. POST {title,author,content}, DELETE query id.', load: () => import("@/app/api/hanhwal/posts/route") },
  hanhwal_fund: { scope: "hanhwal", path: "/api/hanhwal/fund", methods: ["GET", "PATCH"], description: '한활 자금 설정. 슈퍼관리자 전용. 실제 송금 불가.', load: () => import("@/app/api/hanhwal/fund/route") },
  siu_activities: { scope: "social_impact_union", path: "/api/siu/activities", methods: ["GET", "POST"], defaults: { mode: "admin" }, description: '소셜임팩트유니온 활동 목록/생성. 먼저 GET으로 형식 확인.', load: () => import("@/app/api/siu/activities/route") },
  siu_activity: { scope: "social_impact_union", path: "/api/siu/activities/:id", methods: ["GET", "PATCH"], description: '유니온 활동 편집·모집·취소·숨김. PATCH {action:save/close/cancel/hide/unhide,updated_at,activity}. 기존 updated_at과 필드 유지.', load: () => import("@/app/api/siu/activities/[id]/route") },
  siu_applicants: { scope: "social_impact_union", path: "/api/siu/activities/:id/applications", methods: ["GET", "POST"], description: '유니온 활동 참가자. POST 기존 신청관리 action·id·status, 권한 기존 API에서 검사.', load: () => import("@/app/api/siu/activities/[id]/applications/route") },
  siu_roles: { scope: "social_impact_union", path: "/api/siu/roles", methods: ["GET", "PATCH"], description: '유니온 회원 권한 관리. 기존 API의 관리자/슈퍼관리자 경계 유지.', load: () => import("@/app/api/siu/roles/route") },
  jeju_overview: { scope: "jeju", path: "/api/jeju/admin", methods: ["GET"], description: '제주 운영 대시보드·프로그램·참가자 현황.', load: () => import("@/app/api/jeju/admin/route") },
  jeju_places: { scope: "jeju", path: "/api/jeju/places", methods: ["GET", "POST"], description: '제주 장소 조회/생성. 기존 장소 필드 유지.', load: () => import("@/app/api/jeju/places/route") },
  jeju_place: { scope: "jeju", path: "/api/jeju/places/:id", methods: ["GET", "PATCH"], description: '제주 장소 조회/수정. 기존 필드 유지.', load: () => import("@/app/api/jeju/places/[id]/route") },
  jeju_programs: { scope: "jeju", path: "/api/jeju/programs", methods: ["GET", "POST"], description: '제주 체험 프로그램 조회/생성.', load: () => import("@/app/api/jeju/programs/route") },
  jeju_applicants: { scope: "jeju", path: "/api/jeju/programs/:id/applications", methods: ["GET", "PATCH"], description: '프로그램 신청자·상태·관리자 메모. PATCH {applicationId,status,adminNote}.', load: () => import("@/app/api/jeju/programs/[id]/applications/route") },
  research_items: { scope: "research", path: "/api/research", methods: ["GET", "POST"], defaults: { manage: "1" }, description: '연구자료 관리 목록/초안 생성. 기존 한영 필드(titleKo/titleEn/bodyKo/bodyEn), 생성은 private draft.', load: () => import("@/app/api/research/route") },
  research_item: { scope: "research", path: "/api/research/:id", methods: ["GET", "PATCH", "DELETE"], description: '연구자료 수정·검수·공개·삭제. 기존 소유자/편집자/검수 검사 유지.', load: () => import("@/app/api/research/[id]/route") },
  forms: { scope: "ecc", path: "/api/google-forms/forms", methods: ["GET", "POST"], description: '기존 Google Forms 목록 또는 템플릿 초안. POST {presetOnly:true,clubKey:ecc,templateId,title}. 폼 제작 승인 흐름은 별도로 유지.', load: () => import("@/app/api/google-forms/forms/route") },
  form: { scope: "ecc", path: "/api/google-forms/forms/:id", methods: ["PATCH", "DELETE"], description: '등록된 폼 열기/닫기 PATCH {status:open/closed/archived}; 종료행사 삭제 DELETE {confirmedEnded:true}. 원본·응답 보존.', load: () => import("@/app/api/google-forms/forms/[id]/route") },
  form_responses: { scope: "ecc", path: "/api/google-forms/forms/:id/responses", methods: ["GET", "POST"], description: 'Google Form 응답 조회 또는 POST 동기화. 기존 원본 응답 공개 제한 유지.', load: () => import("@/app/api/google-forms/forms/[id]/responses/route") },
  event_plan: { scope: "ecc", path: "/api/event-studio", methods: ["POST"], description: 'AI 행사 계획 생성 {action:plan,clubKey:ecc,message}, 부족정보 질문과 검토 후 별도 승인으로 폼 생성. 이미 승인토큰을 임의 발급/재사용하지 말 것.', load: () => import("@/app/api/event-studio/route") },
  event_archive: { scope: "event_archive", path: "/api/event-archive", methods: ["GET", "POST"], description: '개발자 자료실. GET {id 또는 q,club,batch,type,tag,offset}. POST {action:labels/review/classify/version,id,labels,text,...}. 원본 불변·AI 동의·공개 검수 체크 유지. 검수 여부나 AI 동의를 사용자 말 없이 추측하지 않는다.', load: () => import("@/app/api/event-archive/route") }
};

export function allowedCapabilities(scopes: readonly AssistantScope[]) {
  return Object.fromEntries(Object.entries(clubCapabilities).filter(([, capability]) => scopes.includes(capability.scope)));
}
