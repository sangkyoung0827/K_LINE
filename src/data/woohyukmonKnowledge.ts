export const woohyukmonKnowledge = {
  identity: {
    name: "우혁몬 / Woohyukmon",
    role: "K_LINE core AI guide",
    description:
      "Woohyukmon is the site-wide AI assistant for K_LINE, a campus-based K-culture platform for university students, especially international students and student communities.",
    tone: ["friendly", "concise", "accurate", "campus-community oriented", "K-culture themed"]
  },
  tracks: {
    summary: "K_LINE has three main tracks: Goods, K-Culture Project, and International Clubs.",
    items: [
      {
        name: "Goods",
        href: "/goods",
        description: "Cultural goods connected to Hanji, calligraphy, Korean archery, and campus life."
      },
      {
        name: "K-Culture Project",
        href: "/k-culture-project",
        description: "Student-friendly Korean cultural project sharing and project documentation."
      },
      {
        name: "International Clubs",
        href: "/our-activities",
        description:
          "International student clubs, ECC, Han-hwal, club posts, free boards, and ECC fund information."
      }
    ]
  },
  goods: {
    href: "/goods",
    items: [
      {
        name: "Hanji Calligraphy LED Light Object",
        koreanName: "한지 서예 LED 오브제",
        href: "/goods/hanji-calligraphy-led-light-object",
        description:
          "A small decorative mood lamp combining Korean Hanji paper, Korean calligraphy, a 3D-printed frame, and warm LED lighting.",
        dimensions: "approx. 14.6 cm x 20.9 cm x 3 cm"
      },
      {
        name: "Arrow Pen",
        koreanName: "화살펜",
        href: "/goods/arrow-pen",
        description:
          "A functional pen inspired by Korean traditional archery. It has the visual form of an arrow while containing a usable pen inside. A transparent cap protects the pen tip.",
        dimensions: "approx. 22 cm length x 0.8 cm diameter"
      }
    ]
  },
  kCultureProjects: {
    href: "/k-culture-project",
    featured: {
      title: "한국의 선, 유럽을 잇다",
      englishTitle: "Connecting Korean Lines to Europe",
      href: "/k-culture-project/connecting-korean-lines-to-europe",
      description:
        "A K-culture project connecting Hanji, Korean calligraphy, 3D printing, LED object design, and Korea-Europe cultural exchange."
    },
    submission: {
      href: "/k-culture-project/submit",
      note: "Users can use the project submission page to prepare a K-Culture Project entry. Real backend review and moderation are future work."
    }
  },
  activities: {
    href: "/our-activities",
    summary:
      "International Clubs includes ECC and Han-hwal club records, free boards, writing flows, and ECC fund management.",
    writeHref: "/our-activities/write",
    note: "Activity writing is currently a prototype flow. Permanent public publishing needs backend storage and moderation."
  },
  ecc: {
    name: "ECC",
    fullName: "English Conversation Club",
    href: "/our-activities/ecc",
    activityHref: "/our-activities/ecc/activity",
    freeBoardHref: "/our-activities/ecc/free-board",
    fundHref: "/our-activities/ecc/fund",
    description:
      "ECC is a student community where Korean students and international students interact through English, campus activities, and cultural exchange. Its menu includes an ECC free board, ECC activity management, and ECC fund management page."
  },
  hanHwal: {
    name: "Han-hwal",
    koreanName: "한활",
    projectHref: "/k-culture-project/han-hwal",
    activityHref: "/our-activities/hanhwal",
    keySentence: "우리는 국궁으로 심신을 수련하는 한활입니다.",
    englishVersion:
      "Han-hwal is a community that trains body and mind through Korean traditional archery.",
    description:
      "Han-hwal is a Korean traditional archery and cultural activity community for body-mind training and cultural exchange."
  },
  faq: [
    {
      question: "What is K_LINE?",
      answer:
        "K_LINE is a campus-based K-culture platform for university students, especially international students and student communities."
    },
    {
      question: "What can I do on K_LINE?",
      answer:
        "You can explore Goods, K-Culture Project, and International Clubs, including ECC free board, ECC fund information, and Han-hwal community boards."
    },
    {
      question: "Is payment available?",
      answer:
        "Real payment is not connected yet. Goods are currently inquiry-based while payment and inventory systems are prepared."
    }
  ],
  writingHelp: {
    projectStructure: [
      "Project title",
      "Short description",
      "Cultural theme",
      "Target participants",
      "Activity or product plan",
      "Expected outcome"
    ],
    activityPostStructure: ["Title", "Date or activity context", "People involved", "Main story", "Photos", "Next step"],
    note:
      "If users ask for writing help, provide a short useful structure and guide them to the relevant page."
  },
  contact: {
    href: "/contact",
    note:
      "If information is missing or not available yet, Woohyukmon should say so and guide users to Contact."
  },
  future: {
    database: "Future database-backed knowledge and persistent chat history can be connected later.",
    vectorSearch: "Future vector search can index posts, uploaded files, project records, and admin-managed FAQ.",
    adminKnowledge: "Future admin tools can manage knowledge, moderation, and public FAQ."
  }
} as const;

export const woohyukmonQuickPrompts = {
  en: [
    "What is K_LINE?",
    "Tell me about Goods",
    "What is ECC?",
    "What is Han-hwal?",
    "How do I submit a project?",
    "How do I write an activity post?",
    "What is the Arrow Pen?",
    "What is the Hanji LED object?"
  ],
  ko: [
    "K_LINE이 뭐예요?",
    "굿즈에 대해 알려줘",
    "ECC가 뭐예요?",
    "한활이 뭐예요?",
    "프로젝트는 어떻게 올리나요?",
    "활동 글은 어떻게 쓰나요?",
    "화살펜이 뭐예요?",
    "한지 오브제가 뭐예요?"
  ]
} as const;
