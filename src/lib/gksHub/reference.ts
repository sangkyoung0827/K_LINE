export type GksDegree = "M" | "D" | "R";
export type GksTrack = "University" | "Embassy";
export type GksForm = "f2" | "f3";
export type GksStage = "todo" | "working" | "ready";
export type GksDocument = {
  id: string; name: string; detail: string; group: string; degrees: string;
  kind: "required" | "conditional" | "optional"; hint: string; tips: string[];
};
export type GksWriterField = { id: string; ko: string; en: string; hint: string };

// Preserved from the supplied standalone prototype; this is a 2026 reference snapshot.
export const docCatalog: GksDocument[] = [
      {id:'f1',name:'지원신청서',detail:'Form 1',group:'forms',degrees:'MDR',kind:'required',hint:'기본 인적사항 · 희망 과정 · 대학',tips:['여권과 동일한 영문 이름','지원 대학·학과의 최신 모집 여부']},
      {id:'f2',name:'자기소개서',detail:'Form 2',group:'forms',degrees:'MDR',kind:'required',hint:'동기 · 경험 · 한국 유학 이유',tips:['전공 관심의 계기','구체적 경험과 증빙','한국과 모국을 연결할 목표']},
      {id:'f3',name:'학업계획서',detail:'Form 3',group:'forms',degrees:'MD',kind:'required',hint:'학습 목표 · 연구 계획 · 진로',tips:['입학 전 한국어 준비','대학원에서 다룰 주제','졸업 후 실행 계획']},
      {id:'f4',name:'연구제안서',detail:'Form 4',group:'forms',degrees:'R',kind:'required',hint:'연구과정 지원자 전용',tips:['연구 주제와 질문','연구 방법·일정','예상 성과']},
      {id:'f5',name:'추천서 1부',detail:'Form 5',group:'forms',degrees:'MDR',kind:'required',hint:'추천인 작성 · 서명 및 봉인',tips:['추천인에게 공식 서식 전달','지원자 활동을 직접 아는 추천인','봉인·제출 방식 대학별 확인']},
      {id:'f6',name:'연구 초청장',detail:'Form 6',group:'forms',degrees:'R',kind:'required',hint:'연구과정 수학대학 발행',tips:['수학대학의 공식 초청장','연구과정 전용']},
      {id:'f7',name:'한국어연수 면제 신청',detail:'Form 7',group:'forms',degrees:'MD',kind:'conditional',hint:'해당 현직 교수만 신청',tips:['전 과정 영어 수업 등 자격 확인','일반 석사 지원자는 대개 해당 없음']},
      {id:'f8',name:'GKS 지원자 서약',detail:'Form 8',group:'forms',degrees:'MDR',kind:'required',hint:'지원 규정 확인 · 서명',tips:['서약 내용 숙지','서명 누락 주의']},
      {id:'f9',name:'건강 자가진단',detail:'Form 9',group:'forms',degrees:'MDR',kind:'required',hint:'Personal Medical Assessment',tips:['문항 사실대로 기재','정식 건강검진과 구분']},
      {id:'f10',name:'개인정보 동의',detail:'Form 10',group:'forms',degrees:'MDR',kind:'required',hint:'수집 및 이용 동의 · 서명',tips:['모든 필수 서명란 확인']},
      {id:'citizenship',name:'국적 · 가족관계 증명',detail:'Certificate 11',group:'cert',degrees:'MDR',kind:'required',hint:'지원자·부모 국적 및 관계',tips:['지원자와 부모의 국적 증빙','가족관계를 입증할 증명서','번역·아포스티유 요건 확인']},
      {id:'bachelor-degree',name:'학사 학위(졸업) 증명',detail:'Certificate 12',group:'cert',degrees:'MDR',kind:'required',hint:'졸업증명서 · 학위증 · 예정증명',tips:['발급 기관과 학위명 확인','필요한 인증·번역 준비']},
      {id:'bachelor-transcript',name:'학사 성적증명',detail:'Certificate 12′',group:'cert',degrees:'MDR',kind:'required',hint:'전체 학기 성적 · CGPA',tips:['전체 성적과 평점 표기','GKS 인정 점수 체계 확인','필요한 인증·번역 준비']},
      {id:'master-degree',name:'석사 학위(졸업) 증명',detail:'Certificate 13',group:'cert',degrees:'DR',kind:'required',hint:'박사·연구과정 지원',tips:['석사 학위 증명','인증·번역 요건 확인']},
      {id:'master-transcript',name:'석사 성적증명',detail:'Certificate 13′',group:'cert',degrees:'DR',kind:'required',hint:'박사·연구과정 지원',tips:['석사 전 과정 성적','평점 또는 백분위 확인']},
      {id:'doctoral-degree',name:'박사 학위 증명',detail:'Certificate 14',group:'cert',degrees:'R',kind:'conditional',hint:'박사후연구 지원자',tips:['박사후연구 유형에 해당하는 경우']},
      {id:'doctoral-transcript',name:'박사 성적증명',detail:'Certificate 14′',group:'cert',degrees:'R',kind:'conditional',hint:'박사후연구 지원자',tips:['박사후연구 유형에 해당하는 경우']},
      {id:'professional-employment',name:'재직 증명',detail:'Certificate 15',group:'cert',degrees:'R',kind:'conditional',hint:'전문가 연구과정 지원자',tips:['전문가 연구과정에 해당하는 경우']},
      {id:'overseas-korean',name:'재외동포·입양인 증명',detail:'Certificate 16',group:'conditional',degrees:'MDR',kind:'conditional',hint:'해당 자격으로 지원하는 경우',tips:['관련 유형과 지원자격 확인']},
      {id:'renunciation',name:'한국 국적 이탈 증명',detail:'Document 17',group:'conditional',degrees:'MDR',kind:'conditional',hint:'본인·부모 과거 한국 국적 관련',tips:['해당 이력이 있는 경우만']},
      {id:'war-veteran',name:'참전용사 후손 증명',detail:'Document 18',group:'conditional',degrees:'MDR',kind:'conditional',hint:'해당 특별 증빙이 있는 경우',tips:['해당하는 경우에만 제출']},
      {id:'employment',name:'재직 · 경력 증명',detail:'Document 19',group:'optional',degrees:'MD',kind:'optional',hint:'교직·국제기구 경력 등',tips:['검증 가능한 경력만 기재','직접 증빙할 수 있는 활동 선택']},
      {id:'language',name:'TOPIK · 영어 성적',detail:'Document 20',group:'optional',degrees:'MDR',kind:'optional',hint:'유효한 공인어학 성적',tips:['유효기간과 원본 여부','대학별 전공 언어요건 별도 확인']},
      {id:'awards',name:'수상 · 활동 증빙',detail:'Document 21',group:'optional',degrees:'MDR',kind:'optional',hint:'수상·연구·활동 실적',tips:['실제로 수행·발행된 성과만','K_LINE 연구 아카이브와 증빙 구분']},
      {id:'passport',name:'여권 사본',detail:'Document 22',group:'optional',degrees:'MDR',kind:'optional',hint:'신원정보 대조용',tips:['여권 정보와 지원서 이름 일치']},
      {id:'translation',name:'공증 번역·인증 점검',detail:'추가 점검',group:'conditional',degrees:'MDR',kind:'conditional',hint:'영어·한국어 외 발급 문서',tips:['원문 및 공증된 영문·국문 번역','해당 문서 아포스티유·영사확인 요건']},
      {id:'gpa',name:'성적 환산 자료',detail:'추가 점검',group:'conditional',degrees:'MDR',kind:'conditional',hint:'성적표에 인정 평점이 없는 경우',tips:['공식 환산표 또는 석차 증빙','지원요강 인정 기준으로 대조']},
      {id:'university-extra',name:'대학별 추가 서류',detail:'대학 확인',group:'conditional',degrees:'MDR',kind:'conditional',hint:'학과·대학별 별도 서식·포트폴리오',tips:['지원 대학 공고 및 학과 요구 확인','대학별 제출 방식·마감 별도 확인']},
      {id:'jbnu-submission',name:'전북대 별도 제출 절차',detail:'JBNU 2026',group:'conditional',degrees:'MDR',kind:'conditional',hint:'원본·사본 및 별도 온라인 신청',tips:['2026년에는 원본 1세트 + 사본 1세트','구글폼 신청 병행 공고','2027년 방식은 새 공고 확인']}
    ];
export const schools = [{id:'jbnu',name:'전북대학교',eng:'Jeonbuk National University',place:'전주'},{id:'snu',name:'서울대학교',eng:'Seoul National University',place:'서울'},{id:'pusan',name:'부산대학교',eng:'Pusan National University',place:'부산'},{id:'yonsei',name:'연세대학교',eng:'Yonsei University',place:'서울'}];
export const writerFields: Record<GksForm, GksWriterField[]> = {
      f2:[{id:'motivation',ko:'지원 동기',en:'Motivation',hint:'왜 한국에서 이 전공을 공부하고 싶나요?'},{id:'background',ko:'학업 배경',en:'Education',hint:'학업·전공·직무 경험을 정리하세요.'},{id:'experience',ko:'활동과 성과',en:'Experience',hint:'수상·연구·봉사·중요한 경험을 적으세요.'},{id:'contribution',ko:'배운 점과 목표',en:'Contribution',hint:'그 경험이 앞으로의 목표와 어떻게 연결되나요?'}],
      f3:[{id:'language',ko:'언어 학습 계획',en:'Language Study Plan',hint:'입학 전·후 한국어와 영어 학습 계획'},{id:'study',ko:'학업 목표와 계획',en:'Goal of Study & Study Plan',hint:'관심 분야·수업·연구 일정·방법'},{id:'future',ko:'졸업 후 계획',en:'Future Plan after Study',hint:'졸업 후 진로와 한국–모국 간 기여 계획'}]
    };
export const countryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK`.split(' ');

