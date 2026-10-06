import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleFormsManager } from "../../src/components/google-forms/GoogleFormsManager";
import { googleFormTemplates } from "../../src/lib/googleForms/templates";
import { draftFromTemplate } from "../../src/lib/googleForms/templates";
import { generateActivityNotice } from "../../src/lib/googleForms/planning";
import { ActivityNoticeOutput } from "../../src/components/google-forms/ActivityNoticeOutput";
import noticeAudit from "../../docs/google-forms-notice-verified-20261006.json";

function NoticePreview() {
  const [error, setError] = React.useState("");
  const [templateId, setTemplateId] = React.useState("ecc_gathering");
  const novel = noticeAudit.records.find(record => record.source === "live existing Woohyukmon API" && "notice" in record);
  const template = googleFormTemplates.find(item => item.id === templateId);
  const notice = templateId === "new-activity" ? novel?.notice || "" : generateActivityNotice(draftFromTemplate(templateId === "general_activity" ? "general" : "ecc", templateId, template?.label || ""));
  return <section className="mx-auto max-w-3xl px-5 py-8">
    <h1 className="mb-5 text-xl font-semibold">우혁몬 활동 공지</h1>
    <label className="mb-5 block">활동<select className="form-field mt-2 w-full" value={templateId} onChange={event => setTemplateId(event.target.value)}>
      {googleFormTemplates.filter(item => item.questions.length).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      <option value="new-activity">{novel?.case || "새 활동"}</option>
    </select></label>
    <ActivityNoticeOutput notice={notice} applicationUrl="" onError={setError} />
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}

createRoot(document.getElementById("root")!).render(<>
  <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-gray-900">
    비공개 연동 테스트 · 실제 Google Forms / Supabase · 운영 배포 없음
  </div>
  {new URLSearchParams(window.location.search).has("noticePreview") ? <NoticePreview /> : <GoogleFormsManager initialAccess={{ email: "waterfallingsound0827@gmail.com", authenticated: true, canConnect: false, isReadOnly: false, manageableClubs: ["ecc"] }} templates={googleFormTemplates} />}
</>);
