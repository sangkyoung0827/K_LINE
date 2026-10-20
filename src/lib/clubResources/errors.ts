export function resourceError(error: unknown, ko: boolean) {
  const code = error instanceof Error ? error.message : String(error);
  const messages: Record<string, [string,string]> = {
    OFFICIAL_MEMBERSHIP_REQUIRED: ["한활 정식회원만 업로드할 수 있습니다.", "Hanhwal official membership is required to upload."],
    INVALID_CATEGORY: ["자료 분류를 확인해주세요.", "Please check the category."],
    INVALID_VISIBILITY: ["공개 범위를 확인해주세요.", "Please check the visibility."],
    TITLE_REQUIRED: ["제목을 입력해주세요.", "Enter a title."],
    INVALID_FILE: ["지원하는 형식의 50MB 이하 파일을 선택해주세요.", "Choose a supported file up to 50 MB."],
    FILE_VERIFICATION_FAILED: ["파일 크기나 형식이 일치하지 않습니다. 원본 파일을 다시 업로드해주세요.", "The file size or type did not match. Upload the original file again."],
    NOT_FOUND: ["자료가 없거나 열람 권한이 없습니다.", "Resource unavailable or access denied."],
    RESOURCE_UNAVAILABLE: ["자료실에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.", "The resource library is unavailable. Please retry."],
    FORBIDDEN: ["운영진 권한이 필요합니다.", "Staff permission is required."],
    REVISION_CONFLICT: ["다른 작업에서 변경됐습니다. 새로고침 후 다시 시도해주세요.", "This resource changed. Refresh and retry."]
  };
  return messages[code]?.[ko ? 0 : 1] || code;
}
