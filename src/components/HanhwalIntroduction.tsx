import { I18nText } from "@/components/LanguageProvider";

export function HanhwalIntroduction() {
  return (
    <section className="mt-6 border-y border-navy/10 py-6 sm:mt-10 sm:py-8">
      <p className="text-xs font-bold uppercase text-brass">About Hanhwal</p>
      <h2 className="mt-2 font-serif text-2xl font-semibold text-navy sm:text-3xl">
        <I18nText en="Practice Korean archery together" ko="함께 배우고 수련하는 한국 활쏘기" />
      </h2>
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink/75 sm:text-base sm:leading-8">
        <I18nText
          en="Hanhwal is a community that trains body and mind through Gungdo, traditional Korean archery. Beginners learn posture and shooting form step by step. Through regular practice, university competitions, member exchanges, group equipment orders, and uniform orders, we continue Korean archery culture together."
          ko={"한활은 한국의 전통 활쏘기인 국궁을 통해 몸과 마음을 수련하는 모임입니다. 처음 활을 잡는 사람도 기본 자세와 사법부터 차근차근 배우며, 함께 활을 쏘고 연습하는 과정에서 집중과 절제, 서로에 대한 배려를 익혀갑니다. 정기 활쏘기 연습을 중심으로 대학생 활쏘기 대회와 회원 교류 활동, 개인 활·화살 및 단체복 공동주문 등을 함께 운영합니다. 한활은 국궁을 단순히 체험하는 데 그치지 않고 직접 배우고 반복해 수련하며 한국 활쏘기의 문화를 함께 이어가는 공동체를 지향합니다."}
        />
      </p>
    </section>
  );
}
