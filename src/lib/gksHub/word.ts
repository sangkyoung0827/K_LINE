import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { gksText, gksWriterTitle, validateGksWriter } from "./model";
import { writerFields, type GksForm } from "./reference";

export async function createGksWord(form: GksForm, data: Record<string, string>, language: "ko" | "en") {
  if (validateGksWriter(form, data)) throw new Error("INCOMPLETE_GKS_DRAFT");
  const paragraph = (text: string) => new Paragraph({ children: [new TextRun(gksText(text))], spacing: { after: 140, line: 330 } });
  const document = new Document({
    creator: "K_LINE GKS Hub",
    title: gksWriterTitle(form),
    description: "Editable preparation draft. Not an official application form.",
    styles: { default: {
      document: { run: { font: { ascii: "Arial", hAnsi: "Arial", eastAsia: "Malgun Gothic" }, size: 22, color: "000000", language: { value: "en-US", eastAsia: "ko-KR" } } },
      title: { run: { size: 34, bold: true, color: "000000" }, paragraph: { spacing: { after: 260 } } },
      heading2: { run: { size: 25, bold: true, color: "000000" }, paragraph: { spacing: { before: 240, after: 120 } } }
    } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: [
      new Paragraph({ text: gksWriterTitle(form), heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
      paragraph(`Applicant: ${gksText(data.fullName, 120)}`),
      ...writerFields[form].flatMap(f => [
        new Paragraph({ text: language === "ko" ? f.ko : f.en, heading: HeadingLevel.HEADING_2, keepNext: true }),
        ...gksText(data[f.id]).split(/\r\n|\r|\n/).map(line => paragraph(line || " "))
      ]),
      paragraph("Date: __________________"), paragraph(`Name: ${gksText(data.fullName, 120)}`), paragraph("Signature: __________________"),
      paragraph(language === "ko" ? "편집용 초안입니다. 제출 전 해당 연도 공식 서식과 모집요강을 확인하세요." : "Preparation draft only. Check the current official form and application guidelines before submitting.")
    ] }]
  });
  return Packer.toBlob(document);
}
