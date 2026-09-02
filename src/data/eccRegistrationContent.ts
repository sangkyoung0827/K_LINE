export type EccRegistrationContent = {
  body: string;
  title: string;
  updatedAt: string;
};

export const defaultEccRegistrationContent: EccRegistrationContent = {
  title: "ECC New Member Registration",
  body: `👋 Welcome to ECC!

ECC is the English Conversation Club at Jeonbuk National University.
Please fill out this form after checking the membership fee information.

Membership Fee:
Amount: 15,000 KRW
Bank Account: 3333-30-3496426 / ECC OFICIAL / 카카오뱅크 예금주 이상경

Cash Payment:
If you do not have a Korean bank account, you can pay in cash at the ECC office.
Cash payment is available until September 4th (Fri), from 17:00 to 18:00.
Location: ECC room, 2nd floor of 동아리 전용관.

Notice:
Please write your information correctly.
ECC officers will check your form and payment.

Instagram:
@ecc_jbnu

Thank you! 💚`,
  updatedAt: ""
};
