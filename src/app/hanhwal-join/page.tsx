import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HanhwalMemberRegistrationForm } from "@/components/HanhwalMemberRegistrationForm";
import { HanhwalPublicShell } from "@/components/HanhwalPublicShell";
import { I18nText } from "@/components/LanguageProvider";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { hanhwalFacts } from "@/lib/hanhwalPublic";
import { createNoIndexMetadata } from "@/lib/seo";
import styles from "./join.module.css";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Hanhwal New Member Registration",
  description: "Private Hanhwal new member registration page for K_LINE Google-login users.",
  path: "/hanhwal-join"
});

export default async function HanhwalJoinPage() {
  const access = await getCurrentHanhwalAccess();

  if (!access.isLoggedIn) {
    redirect("/login?callbackUrl=/hanhwal-join");
  }

  return (
    <HanhwalPublicShell>
      <main className={styles.joinPage}>
        <div className={styles.content}>
          <header className={styles.pageHeader}>
            <p className={styles.eyebrow}>BECOME PART OF HANHWAL</p>
            <h1><I18nText en="Join Hanhwal" ko="한활 가입하기" /></h1>
            <p className={styles.intro}>
              <I18nText
                en="Interested in Korean traditional archery? Register below and come practice with us!"
                ko="한국 전통 활쏘기에 관심이 있나요? 아래에서 가입하고 함께 연습해요!"
              />
            </p>
          </header>

          <section className={styles.membershipFee} aria-labelledby="hanhwal-membership-fee">
            <h2 id="hanhwal-membership-fee"><I18nText en="Membership Fee" ko="회비 안내" /></h2>
            <p><strong><I18nText en="New Members:" ko="신규회원:" /></strong> ₩{hanhwalFacts.newMemberFee.replace(" KRW", "")}</p>
            <p><strong><I18nText en="Returning Members:" ko="기존회원:" /></strong> ₩{hanhwalFacts.returningMemberFee.replace(" KRW", "")}</p>
            <p className={styles.feeNote}>
              <I18nText
                en="Payment information will be provided after your registration is confirmed."
                ko="등록 확인 후 회비 납부 방법을 안내해 드립니다."
              />
            </p>
          </section>

          <HanhwalMemberRegistrationForm variant="site" />
        </div>
      </main>
    </HanhwalPublicShell>
  );
}
