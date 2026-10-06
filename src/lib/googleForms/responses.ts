export type FormStructure = {
  items?: Array<{
    itemId?: string;
    title?: string;
    questionItem?: { question?: { questionId?: string } };
    questionGroupItem?: { questions?: Array<{ questionId?: string; rowQuestion?: { title?: string } }> };
  }>;
};

export type FormAnswer = {
  textAnswers?: { answers?: Array<{ value?: string }> };
  fileUploadAnswers?: { answers?: Array<{ fileId?: string; fileName?: string; mimeType?: string }> };
};

export function mapResponseAnswers(form: FormStructure, answers: Record<string, FormAnswer> = {}) {
  const questions = new Map<string, { itemId: string; title: string }>();
  for (const item of form.items || []) {
    const questionId = item.questionItem?.question?.questionId;
    if (questionId) questions.set(questionId, { itemId: item.itemId || "", title: item.title || questionId });
    for (const question of item.questionGroupItem?.questions || []) {
      if (question.questionId) questions.set(question.questionId, {
        itemId: item.itemId || "", title: [item.title, question.rowQuestion?.title].filter(Boolean).join(" / ") || question.questionId
      });
    }
  }
  // Keep IDs as keys: repeated titles and removed questions must not lose answers.
  return Object.fromEntries(Object.entries(answers).map(([questionId, answer]) => [questionId, {
    questionId, itemId: questions.get(questionId)?.itemId || null,
    title: questions.get(questionId)?.title || questionId,
    values: (answer.textAnswers?.answers || []).map((entry) => entry.value || ""),
    files: answer.fileUploadAnswers?.answers || [],
    removed: !questions.has(questionId)
  }]));
}

export function actualResponderUrl(value: string | undefined) {
  if (!value) throw new Error("GOOGLE_RESPONDER_URL_MISSING");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" ||
      !/^\/forms\/d\/(?:e\/)?[^/]+\/viewform\/?$/.test(url.pathname) || url.username || url.password) {
    throw new Error("GOOGLE_RESPONDER_URL_INVALID");
  }
  return url.href;
}
