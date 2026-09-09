"use client";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ClubKey, SectionDataMap, SectionType } from "@/types/club-page";
import { Field, ImageField } from "./Fields";
import styles from "../club-page.module.css";
export type EditorProps<K extends SectionType> = { clubKey: ClubKey; data: SectionDataMap[K]; onChange: (data: SectionDataMap[K]) => void };

function Items<T>({ items, empty, limit, onChange, children }: { items: T[]; empty: T; limit: number; onChange: (items: T[]) => void; children: (item: T, set: (next: T) => void, index: number) => ReactNode }) {
  return <div>{items.map((item, index) => <div className={styles.itemEditor} key={index}>
    <div className={styles.itemHeader}><span>{index + 1}</span><button type="button" aria-label={`${index + 1}번 항목 삭제`} title="항목 삭제" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>
    {children(item, next => onChange(items.map((old, i) => i === index ? next : old)), index)}
  </div>)}<button className={styles.secondary} type="button" disabled={items.length >= limit} onClick={() => onChange([...items, { ...empty }])}><Plus size={16} />항목 추가 ({items.length}/{limit})</button></div>;
}
export function HeroEditor({ data, clubKey, onChange }: EditorProps<"hero">) {
  return <><Field label="제목" value={data.title} onChange={title => onChange({ ...data, title })} /><Field label="소개" value={data.subtitle} multiline limit={1000} onChange={subtitle => onChange({ ...data, subtitle })} /><ImageField clubKey={clubKey} value={data.imageUrl} onChange={imageUrl => onChange({ ...data, imageUrl })} /><Field label="버튼 이름" value={data.buttonLabel} limit={100} onChange={buttonLabel => onChange({ ...data, buttonLabel })} /><Field label="버튼 링크" value={data.buttonUrl} limit={2048} onChange={buttonUrl => onChange({ ...data, buttonUrl })} /></>;
}
export function AboutEditor({ data, onChange }: EditorProps<"about">) {
  return <><Field label="제목" value={data.heading} onChange={heading => onChange({ ...data, heading })} /><Field label="본문" value={data.body} multiline limit={5000} onChange={body => onChange({ ...data, body })} /></>;
}
export function GalleryEditor({ data, clubKey, onChange }: EditorProps<"gallery">) {
  return <><Field label="제목" value={data.heading} onChange={heading => onChange({ ...data, heading })} /><Items items={data.images} empty={{ imageUrl: "", caption: "" }} limit={24} onChange={images => onChange({ ...data, images })}>{(item, set) => <><ImageField clubKey={clubKey} value={item.imageUrl} onChange={imageUrl => set({ ...item, imageUrl })} /><Field label="사진 설명 / 대체 텍스트" value={item.caption} limit={300} onChange={caption => set({ ...item, caption })} /></>}</Items></>;
}
export function ScheduleEditor({ data, onChange }: EditorProps<"schedule">) {
  return <><Field label="제목" value={data.heading} onChange={heading => onChange({ ...data, heading })} /><Items items={data.items} empty={{ date: "", title: "", description: "" }} limit={30} onChange={items => onChange({ ...data, items })}>{(item, set) => <><Field label="날짜 / 시간" value={item.date} limit={100} onChange={date => set({ ...item, date })} /><Field label="일정 이름" value={item.title} onChange={title => set({ ...item, title })} /><Field label="내용" value={item.description} multiline limit={1000} onChange={description => set({ ...item, description })} /></>}</Items></>;
}
export function MembersEditor({ data, clubKey, onChange }: EditorProps<"members">) {
  return <><Field label="제목" value={data.heading} onChange={heading => onChange({ ...data, heading })} /><Items items={data.members} empty={{ name: "", role: "", imageUrl: "", description: "" }} limit={30} onChange={members => onChange({ ...data, members })}>{(item, set) => <><Field label="공개할 이름" value={item.name} onChange={name => set({ ...item, name })} /><Field label="역할" value={item.role} onChange={role => set({ ...item, role })} /><ImageField clubKey={clubKey} value={item.imageUrl} onChange={imageUrl => set({ ...item, imageUrl })} /><Field label="소개" value={item.description} multiline limit={1000} onChange={description => set({ ...item, description })} /></>}</Items></>;
}
export function RecruitEditor({ data, onChange }: EditorProps<"recruit">) {
  return <><Field label="제목" value={data.heading} onChange={heading => onChange({ ...data, heading })} /><Field label="모집 안내" value={data.description} multiline limit={5000} onChange={description => onChange({ ...data, description })} /><Field label="버튼 이름" value={data.buttonLabel} limit={100} onChange={buttonLabel => onChange({ ...data, buttonLabel })} /><Field label="신청 링크" value={data.buttonUrl} limit={2048} onChange={buttonUrl => onChange({ ...data, buttonUrl })} /></>;
}
export function LinksEditor({ data, onChange }: EditorProps<"links">) {
  return <><Field label="제목" value={data.heading} onChange={heading => onChange({ ...data, heading })} /><Items items={data.links} empty={{ label: "", url: "" }} limit={30} onChange={links => onChange({ ...data, links })}>{(item, set) => <><Field label="링크 이름" value={item.label} onChange={label => set({ ...item, label })} /><Field label="공개 링크 URL" value={item.url} limit={2048} onChange={url => set({ ...item, url })} /></>}</Items></>;
}
