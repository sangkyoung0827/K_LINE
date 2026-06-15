export const defaultEccOpenChatUrl = "https://open.kakao.com/o/gTRnoKzi";

export const eccRegistrationConfig = {
  openChatUrl: process.env.NEXT_PUBLIC_ECC_OPEN_CHAT_URL?.trim() || defaultEccOpenChatUrl
};
