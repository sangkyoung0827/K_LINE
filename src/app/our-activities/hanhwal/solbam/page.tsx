"use client";

import Image from "next/image";
import { FormEvent, useRef, useState } from "react";
import { HanhwalPublicShell } from "@/components/HanhwalPublicShell";
import type { HanhwalChatMessage } from "@/lib/hanhwalPublic";
import styles from "../hanhwal.module.css";

const questions = [
  ["🏹", "What is Korean traditional archery (국궁)?"],
  ["🎯", "What does Hanhwal practice?"],
  ["🛡️", "What are the safety rules at Hanhwal practice?"],
  ["📅", "When and where does Hanhwal practice?"],
  ["🏹", "What equipment does Korean traditional archery use?"],
  ["🐆", "Who is Solbam?"]
] as const;

type ChatItem = HanhwalChatMessage & { id: string };

export default function HanhwalSolbamPage() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function ask(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    const id = `${Date.now()}`;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { id: `u-${id}`, role: "user", content: message }]);
    setInput(""); setBusy(true);
    try {
      const response = await fetch("/api/hanhwal/solbam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history }) });
      const payload = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      setMessages((current) => [...current, { id: `a-${id}`, role: "assistant", content: response.ok && payload.answer ? payload.answer : payload.error || "Solbam could not answer right now. Please try again later." }]);
    } catch { setMessages((current) => [...current, { id: `a-${id}`, role: "assistant", content: "The connection was interrupted. Please try again." }]); }
    finally { setBusy(false); window.setTimeout(() => inputRef.current?.focus(), 0); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(input); }

  return <div className={styles.solbamPage}>
    <header className={styles.solbamNavbar}>
      <div className={styles.solbamNavLeft}><a href="/our-activities/hanhwal" className={styles.backButton} aria-label="Back to Hanhwal">←</a><a href="/our-activities/hanhwal" className={styles.solbamBrand}><span className={styles.brandName}>HANHWAL</span><span className={styles.brandDivider}>/</span><span className={styles.brandSolbam}>🐆 Solbam</span></a></div>
      <a href="/our-activities/hanhwal" className={styles.homeLink}>Back to Hanhwal</a>
    </header>
    <main className={styles.solbamMain}>
      <section className={`${styles.welcomeScreen} ${messages.length ? styles.welcomeScreenHidden : ""}`}>
        <div className={styles.solbamAvatarLarge}><Image src="/images/hanhwal-site/solbam.webp" alt="Solbam mascot" fill sizes="100px" /></div>
        <h1>Hi! I&apos;m Solbam 🐆</h1>
        <p className={styles.welcomeDescription}>Your friendly AI companion for <strong>Hanhwal</strong> and Korean traditional archery.</p>
        <p className={styles.welcomeSmall}>Ask me about 국궁, Hanhwal, equipment, practice, safety, etiquette, and Korean archery culture.</p>
        <div className={styles.faqSection}><p className={styles.faqTitle}>You can ask me...</p><div className={styles.faqGrid}>{questions.map(([icon, question]) => <button key={question} type="button" className={styles.faqBubble} onClick={() => void ask(question)}><span className={styles.faqIcon} aria-hidden>{icon}</span><span>{question}</span></button>)}</div></div>
      </section>
      {messages.length > 0 && <section className={styles.chatArea} aria-live="polite"><div className={styles.chatMessages}>{messages.map((message) => <div className={`${styles.messageRow} ${message.role === "user" ? styles.messageRowUser : ""}`} key={message.id}><div className={styles.messageAvatar}>{message.role === "assistant" ? <Image src="/images/hanhwal-site/solbam.webp" alt="" fill sizes="34px" /> : "YOU"}</div><div className={styles.messageContent}><p className={styles.messageName}>{message.role === "assistant" ? "Solbam" : "You"}</p><div className={styles.messageText}>{message.content}</div></div></div>)}{busy && <div className={styles.thinking} aria-label="Solbam is thinking"><span /><span /><span /></div>}</div></section>}
    </main>
    <footer className={styles.chatFooter}><form className={styles.inputContainer} onSubmit={submit}><div className={styles.inputBox}><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} rows={1} maxLength={1000} placeholder="Ask Solbam about Hanhwal or Korean traditional archery..." aria-label="Ask Solbam" /><button className={styles.sendButton} type="submit" disabled={busy || !input.trim()} aria-label="Send message">↑</button></div><p className={styles.inputNotice}>Solbam is specialized in Hanhwal and Korean traditional archery 🏹</p></form></footer>
  </div>;
}
