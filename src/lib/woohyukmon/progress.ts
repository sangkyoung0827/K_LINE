const progressCopy: Record<string, { ko: string; en: string }> = {
  request_started: { ko: "요청을 확인하고 있어요.", en: "I'm checking your request." },
  operation_started: { ko: "요청에 필요한 정보를 확인하고 있어요.", en: "I'm checking the information needed for your request." },
  operation_confirmed: { ko: "승인한 작업을 처리하고 있어요.", en: "I'm carrying out the action you approved." },
  site_sources_started: { ko: "K_LINE 자료를 살펴보고 있어요.", en: "I'm checking K_LINE sources." },
  personal_memory_ready: { ko: "이전 대화의 맥락을 참고하고 있어요.", en: "I'm using context from your previous conversations." },
  external_search_started: { ko: "관련 자료를 검색하고 있어요.", en: "I'm searching for relevant sources." },
  database_search_started: { ko: "요청과 관련된 자료를 확인하고 있어요.", en: "I'm checking sources relevant to your request." },
  external_search_done: { ko: "찾은 자료를 바탕으로 답변을 정리하고 있어요.", en: "I'm preparing an answer using the sources I found." },
  database_search_done: { ko: "확인한 자료를 바탕으로 답변을 정리하고 있어요.", en: "I'm preparing an answer using the sources I checked." },
  external_search_no_results: { ko: "검색 결과가 부족해 확인 가능한 범위로 답변을 정리하고 있어요.", en: "Search results are limited. I'm preparing an answer within what I can verify." },
  conversation_ready: { ko: "대화의 맥락에 맞춰 답변을 정리하고 있어요.", en: "I'm preparing an answer in the context of our conversation." },
  answer_stream_started: { ko: "답변을 정리하고 있어요.", en: "I'm preparing your answer." },
  writing: { ko: "답변을 작성하고 있어요.", en: "I'm writing your answer." },
  business_collection_started: { ko: "요청한 자료를 수집하고 있어요.", en: "I'm collecting the sources you requested." },
  business_staging_done: { ko: "수집한 자료를 정리했어요.", en: "I've organized the collected sources." },
  business_resolution_done: { ko: "중복 자료와 출처를 확인했어요.", en: "I've checked duplicates and sources." },
  business_approval_done: { ko: "검증된 자료를 분석할 준비를 하고 있어요.", en: "I'm preparing the verified sources for analysis." },
  business_analytics_started: { ko: "확인한 자료를 분석하고 있어요.", en: "I'm analyzing the checked sources." },
  business_collection_purged: { ko: "보고서를 완성하고 임시 자료를 정리했어요.", en: "The report is ready and the temporary sources have been cleared." },
  saving_conversation: { ko: "대화 기록을 저장하고 있어요.", en: "I'm saving this conversation." }
};

export function assistantProgressText(stage: string | undefined, language: "ko" | "en") {
  const copy = stage && Object.hasOwn(progressCopy, stage) ? progressCopy[stage] : progressCopy.request_started;
  return copy[language];
}

export function visibleProgressStage(current: string, next: string | undefined) {
  // Diagnostic provider/model events are not user-facing workflow steps.
  return next && Object.hasOwn(progressCopy, next) ? next : current;
}
