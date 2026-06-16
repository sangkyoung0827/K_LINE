import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProjectContributionBoard } from "@/components/ProjectContributionBoard";
import { getProjectBySlug, projects } from "@/data/projects";
import { absoluteUrl, seoKeywords, siteConfig } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const conceptLines = [
  "3D printing gives the form.",
  "Hanji holds the word.",
  "Light reveals the memory."
];

const processSteps = [
  {
    step: "Step 1",
    title: "Choose a Korean word",
    ko: "한국어 단어 선택",
    description: "Pick a word that feels personal: a wish, a memory, a name, or a feeling."
  },
  {
    step: "Step 2",
    title: "Place the 3D printed Hangul guide on Hanji",
    ko: "한지 위에 3D 프린팅 한글 가이드 올리기",
    description: "The detachable plate becomes a guide or type block, not just decoration."
  },
  {
    step: "Step 3",
    title: "Trace or press the word with brush and ink",
    ko: "붓과 먹으로 글자 따라 쓰기",
    description: "The hand follows the Hangul form and leaves a visible rhythm on Jeonju Hanji."
  },
  {
    step: "Step 4",
    title: "Attach the Hanji to the 3D printed frame",
    ko: "한지를 3D 프린팅 프레임에 결합",
    description: "The written Hanji panel becomes the center of the personal object."
  },
  {
    step: "Step 5",
    title: "Turn on the light",
    ko: "불을 켜기",
    description: "Soft light passes through paper, ink, and memory."
  }
];

const objects = [
  {
    label: "Object A",
    title: "Hanji Light Object",
    ko: "한지 조명 오브젝트",
    description:
      "A warm personal light object made from Jeonju Hanji, Korean calligraphy, and a 3D printed frame."
  },
  {
    label: "Object B",
    title: "Hangul & Letter Type Kit",
    ko: "한글 활자 키트",
    description:
      "Detachable Hangul plates that can guide tracing, pressing, and repeated workshop use."
  }
];

const sampleWords = [
  ["Love", "사랑"],
  ["Dream", "꿈"],
  ["Peace", "평화"],
  ["Friend", "친구"],
  ["Light", "빛"],
  ["Spring", "봄"]
];

const galleryCards = [
  {
    word: "빛",
    nickname: "Mina",
    comment: "I chose light because it feels like a small promise to myself."
  },
  {
    word: "평화",
    nickname: "Leo",
    comment: "The Hanji texture made the word feel calmer than normal writing."
  },
  {
    word: "꿈",
    nickname: "Yuna",
    comment: "Tracing Hangul slowly helped me remember the shape."
  }
];

const archiveSections = [
  "Jeonju Pilot Test",
  "London Workshop",
  "Korean Society Collaboration",
  "Participant Interviews"
];

const futureItems = [
  "Workshop program",
  "Custom Hanji light object",
  "DIY Hangul type kit",
  "Hanji postcard kit",
  "Online archive"
];

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    return {
      title: "K-Culture Project"
    };
  }

  const description =
    "From Word to Light is a K-Culture workshop and online exhibition connecting Hanji, Hangul, Korean calligraphy, 3D printing, Jeonju Hanji, Korean typography, and a personal light object.";

  return {
    title: "From Word to Light",
    description,
    keywords: [
      ...seoKeywords,
      "Hanji",
      "Hangul",
      "Korean calligraphy",
      "3D printing",
      "K-Culture workshop",
      "Korean culture",
      "Jeonju Hanji",
      "light object",
      "Korean typography"
    ],
    alternates: {
      canonical: `${siteConfig.url}/k-culture-project/${project.slug}`
    },
    openGraph: {
      title: `From Word to Light | ${siteConfig.name}`,
      description,
      url: `${siteConfig.url}/k-culture-project/${project.slug}`,
      siteName: siteConfig.name,
      images: [
        {
          url: project.image.src,
          alt: project.image.alt
        }
      ],
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `From Word to Light | ${siteConfig.name}`,
      description,
      images: [project.image.src]
    },
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  const projectJsonLd = {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: "From Word to Light",
    alternateName: "Press Your Korean Words on Hanji",
    description: project.shortDescription,
    image: absoluteUrl(project.image.src),
    organizer: {
      "@type": "Organization",
      name: siteConfig.name
    },
    about: [
      "Hanji",
      "Hangul",
      "Korean calligraphy",
      "3D printing",
      "K-Culture workshop",
      "Jeonju Hanji",
      "Korean typography"
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd) }}
      />

      <section className="relative isolate overflow-hidden bg-[#171f33] text-paper">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(214,168,90,0.38),transparent_28%),linear-gradient(120deg,#171f33_0%,#1F2A44_42%,rgba(244,235,221,0.16)_100%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(90deg,rgba(244,235,221,0.09)_1px,transparent_1px),linear-gradient(0deg,rgba(244,235,221,0.07)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="relative mx-auto grid min-h-[88svh] max-w-7xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brass">
              K-Culture Online Exhibition
            </p>
            <h1 className="mt-6 max-w-3xl font-serif text-6xl font-semibold leading-none text-paper md:text-8xl">
              From Word to Light
            </h1>
            <p className="mt-6 text-2xl font-semibold text-brass md:text-3xl">
              Press Your Korean Words on Hanji
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-paper/78">
              A hands-on K-Culture exhibition where Hangul, Jeonju Hanji, 3D printing,
              and light become one personal object.
            </p>
            <p className="mt-4 max-w-2xl break-keep text-sm leading-7 text-paper/54">
              한글, 전주 한지, 3D 프린팅, 빛이 하나의 개인 오브젝트가 되는 참여형 K-컬처 전시입니다.
            </p>
          </div>

          <div className="relative">
            <div className="hanji-object-glow absolute inset-8 rounded-full bg-brass/35 blur-3xl" />
            <div className="relative overflow-hidden border border-paper/16 bg-hanji/12 p-3 shadow-[0_32px_120px_rgba(214,168,90,0.22)]">
              <div className="relative aspect-[4/3] overflow-hidden bg-hanji">
                <Image
                  src={project.image.src}
                  alt={project.image.alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-hanji py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass">
              Core Concept
            </p>
            <div className="mt-8 grid gap-4">
              {conceptLines.map((line) => (
                <p key={line} className="font-serif text-4xl font-semibold text-ink md:text-6xl">
                  {line}
                </p>
              ))}
            </div>
            <p className="mt-8 break-keep text-sm leading-7 text-ink/58">
              3D 프린팅은 형태를 만들고, 한지는 단어를 품고, 빛은 기억을 드러냅니다.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-paper py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <ExhibitionHeader
            eyebrow="How It Works"
            title="A slow process of choosing, tracing, assembling, and lighting."
            ko="단어를 고르고, 한지 위에 쓰고, 프레임에 결합해 빛으로 완성합니다."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {processSteps.map((item) => (
              <article key={item.step} className="border border-ink/10 bg-white/70 p-5 shadow-soft">
                <p className="text-xs font-semibold uppercase text-brass">{item.step}</p>
                <h2 className="mt-4 min-h-16 font-serif text-2xl font-semibold text-ink">
                  {item.title}
                </h2>
                <p className="mt-2 break-keep text-xs font-semibold text-ink/42">{item.ko}</p>
                <p className="mt-5 text-sm leading-7 text-ink/66">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1F2A44] py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass">
              Important Detail
            </p>
            <h2 className="mt-5 font-serif text-4xl font-semibold md:text-6xl">
              The Hangul plate is a working tool.
            </h2>
            <p className="mt-6 text-base leading-8 text-paper/70">
              The 3D printed Hangul plate is not just decoration. It can be detached and used as a
              guide or type block. Participants place it on Hanji and trace the letter with brush
              and ink. The Hanji then becomes the central material that holds the written word.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {objects.map((object) => (
              <article key={object.title} className="border border-paper/12 bg-paper/10 p-6">
                <p className="text-xs font-semibold uppercase text-brass">{object.label}</p>
                <h3 className="mt-4 font-serif text-3xl font-semibold text-paper">{object.title}</h3>
                <p className="mt-2 break-keep text-sm text-paper/45">{object.ko}</p>
                <p className="mt-5 text-sm leading-7 text-paper/68">{object.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-hanji py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <ExhibitionHeader
            eyebrow="Create Your Korean Word"
            title="One word becomes paper, object, and memory."
            ko="하나의 단어가 한지, 오브젝트, 기억이 됩니다."
          />
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {sampleWords.map(([en, ko]) => (
              <div key={en} className="border border-brass/25 bg-white/60 p-5 text-center shadow-soft">
                <p className="text-sm font-semibold uppercase text-brass">{en}</p>
                <p className="mt-3 font-serif text-4xl font-semibold text-ink">{ko}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <ExhibitionHeader
            eyebrow="Participant Gallery"
            title="Future workshop results will gather here."
            ko="워크숍 참여 결과물이 이곳에 전시됩니다."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {galleryCards.map((card, index) => (
              <article key={card.nickname} className="overflow-hidden border border-ink/10 bg-white/70 shadow-soft">
                <div className="relative aspect-[4/3] bg-hanji">
                  <Image
                    src={index === 1 ? "/images/london-dashboard.jpg" : project.image.src}
                    alt={`${card.word} Hanji workshop placeholder`}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover opacity-[0.86]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent" />
                  <p className="absolute bottom-4 left-4 font-serif text-5xl font-semibold text-paper">
                    {card.word}
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase text-brass">
                    Participant / {card.nickname}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-ink/68">{card.comment}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/60 py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-2">
          <div>
            <ExhibitionHeader
              eyebrow="Workshop Archive"
              title="A living archive for tests, workshops, and interviews."
              ko="테스트, 워크숍, 인터뷰를 쌓아가는 기록 공간입니다."
            />
            <div className="mt-8 grid gap-3">
              {archiveSections.map((item) => (
                <div key={item} className="border border-ink/10 bg-paper/80 px-5 py-4 text-lg font-semibold text-ink">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div>
            <ExhibitionHeader
              eyebrow="Future Development"
              title="The project can become a program, object line, and archive."
              ko="워크숍 프로그램, 오브젝트, 키트, 온라인 아카이브로 확장됩니다."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              {futureItems.map((item) => (
                <span key={item} className="border border-brass/30 bg-hanji px-4 py-3 text-sm font-semibold text-ink">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-hanji py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <ProjectContributionBoard projectId={project.id} />
        </div>
      </section>
    </>
  );
}

function ExhibitionHeader({
  eyebrow,
  ko,
  title
}: {
  eyebrow: string;
  ko: string;
  title: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass">{eyebrow}</p>
      <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight text-ink md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 break-keep text-sm leading-7 text-ink/55">{ko}</p>
    </div>
  );
}
