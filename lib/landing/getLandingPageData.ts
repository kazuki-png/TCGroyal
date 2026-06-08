import { headers } from "next/headers";
import type { LandingPageData } from "@/lib/landing/types";

function getTokyoHour(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  return hour === 24 ? 0 : hour;
}

/** Fetches landing content on the server for each request (SSR). */
export async function getLandingPageData(): Promise<LandingPageData> {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const now = new Date();
  const tokyoHour = getTokyoHour(now);
  const isPeak = tokyoHour >= 10 && tokyoHour <= 20;

  const monthlyBuyback = Math.round(
    (850 + tokyoHour * 12) * (isPeak ? 1.08 : 1) * (/mobile/i.test(userAgent) ? 0.95 : 1),
  );
  const satisfactionRate = 98.2;

  return {
    fv: {
      badge: "PSA10特化",
      title: "高価郵送買取",
      description: "海外販路があるため、他社より高価買取が可能。",
      highlights: [
        { icon: "noReduction", label: "基本減額なし" },
        { icon: "sameDay", label: "最短当日査定・振込" },
        { icon: "freeShipping", label: "送料無料" },
      ],
      cardAssetVersion: "1",
      cards: {
        left: "/lp/images/banner_card01.png",
        center: "/lp/images/banner_card02.png",
        right: "/lp/images/banner_card03.png",
      }
    },
    solution: {
      items: [
        {
          icon: "warning",
          text: "他社で大きく減額されてしまった",
        },
        {
          icon: "clock",
          text: "査定や振込まで時間がかかりすぎる",
        },
        {
          icon: "shield",
          text: "PSA10の本当の価値を理解して査定してほしい",
        },
        {
          icon: "shield",
          text: "大切なカードだから、安心できる業者に送りたい",
        },
        {
          icon: "question",
          text: "本当に適正価格で売れるか不安",
        },
        {
          icon: "globe",
          text: "国内だけでなく、海外相場を反映した価格で売りたい",
        },
      ],
      closingBefore: "そのお悩み、",
      closingBrand: "TCG ROYAL",
      closingAfter: " がすべて解決します。",
    },
    fiveReasons: [
      {
        number: 1,
        icon: "medal",
        title: "PSA10特化の高価買取",
        description:
          "PSA10の市場価値を深く理解した専門スタッフが1枚1枚丁寧に査定。国内相場だけでなく、海外市場価格も含めた適正価格で高価買取を実現します。",
      },
      {
        number: 2,
        icon: "globe",
        title: "海外販路による圧倒的な買取力",
        description:
          "海外コレクター向け販売・企業間取引・自社販売網など強固なネットワークを保有。カードの価値を世界基準で最大限評価できるため、他社には真似できない高価買取が可能です。",
      },
      {
        number: 3,
        icon: "shield",
        title: "安心の「基本減額なし」査定",
        description:
          "明らかな破損やケース割れなどを除き、原則として基本減額なしで買取いたします。「送ってみたら大幅に安くなった」といった事前査定とギャップが少なく、安心してご利用いただけます。",
      },
      {
        number: 4,
        icon: "lightning",
        title: "驚きのスピード最短当日査定・振込",
        description:
          "商品到着後、最短当日に査定を行い、すぐにお振込まで完了。お客様をお待たせしない、ノーストレスでスピーディーなお取引をお約束します。",
      },
      {
        number: 5,
        icon: "phone",
        title: "送料無料 ＆ LINEでかんたん無料査定",
        description:
          "お送りいただく際の送料は当社が全額負担（着払い）。発送前にいくらになるか不安な方は、お写真を送るだけのLINE無料査定をぜひご利用ください。",
      },
    ],
    whyHighPrice: {
      heading: "なぜ高価買取が可能なのか？",
      cardTitle: "多方面の販路を保有",
      intro:
        "当社は単一の販売先に依存せず、複数の強力な販路を保有しています。",
      bullets: ["海外コレクター販売", "企業間取引", "自社EC販売"],
      closing:
        "常に世界中で最も高く売れる市場を選択できるため、カードの価値を最大限に評価した買取価格のご提示が可能です。",
    },
    difference: {
      heading: "他社との",
      headingAccent: "圧倒的な違い",
      items: [
        {
          label: "PSA10専門性",
          tcgRoyal: "◎\nPSA10特化",
          companyA: "△\nPSA以外も混在",
          companyB: "△\nPSA以外も混在",
        },
        {
          label: "買取価格",
          tcgRoyal: "◎\n海外販路で高価",
          companyA: "○\n一般相場",
          companyB: "△\n国内相場中心",
        },
        {
          label: "減額",
          tcgRoyal: "◎\n基本減額なし",
          companyA: "△\n大幅減額あり",
          companyB: "△\n到着後減額あり",
        },
        {
          label: "査定速度",
          tcgRoyal: "◎\n最短当日",
          companyA: "△\n2〜5営業日",
          companyB: "△\n数日〜1週間",
        },
        {
          label: "振込速度",
          tcgRoyal: "◎\n最短当日",
          companyA: "△\n翌営業日以降",
          companyB: "△\n数営業日後",
        },
        {
          label: "送料",
          tcgRoyal: "◎\n送料無料",
          companyA: "○\n条件付き無料",
          companyB: "△\n自己負担",
        },
        {
          label: "海外販路",
          tcgRoyal: "◎\nあり",
          companyA: "△\n一部のみ",
          companyB: "×\nなし",
        },
        {
          label: "LINE査定",
          tcgRoyal: "◎\nあり",
          companyA: "○\nあり",
          companyB: "×\nなし",
        },
        {
          label: "手軽さ",
          tcgRoyal: "◎\nカートに\n入れるだけ",
          companyA: "△\n入力項目が\n多い",
          companyB: "△\n手続きが複雑",
        },
      ],
    },
    fiveSteps: [
      {
        step: 1,
        title: "カードをカートに追加",
        description:
          "サイト上から売りたいカードを探し、カートに追加して買取申し込みを行います。",
        icon: "cart",
      },
      {
        step: 2,
        title: "カードを発送",
        description:
          "傷がつかないよう梱包し、着払い（送料無料）で当社宛に発送してください。",
        icon: "ship",
      },
      {
        step: 3,
        title: "査定",
        description:
          "商品到着後、専門スタッフが迅速・丁寧に査定を行います。最短当日完了。",
        icon: "assessment",
      },
      {
        step: 4,
        title: "承認 / キャンセル",
        description:
          "査定結果をご連絡いたします。金額にご納得いただければ承認、万が一合わない場合はキャンセルも無料です。",
        icon: "approve",
      },
      {
        step: 5,
        title: "お振込",
        description: "ご承認後、すみやかにご指定の口座へお振込いたします。",
        icon: "payment",
      },
    ],
    faq: [
      {
        question: "キャンセルは可能ですか？",
        answer: "はい、可能です。返送料も無料となっております。",
      },
      {
        question: "減額されることはありますか？",
        answer:
          "明らかな破損やケース割れがない限り、基本減額なしで査定しております。",
      },
      {
        question: "送料はかかりますか？",
        answer: "送料無料です。着払いで発送ください。",
      },
      {
        question: "振込までどれくらいかかりますか？",
        answer: "最短で査定当日にお振込いたします。",
      },
      {
        question: "査定費用はかかりますか？",
        answer: "完全無料です。枚数が多くても無料でご利用いただけます。",
      },
      {
        question: "1枚からでも利用できますか？",
        answer: "もちろん可能です。お気軽にご利用ください。",
      },
      {
        question: "査定金額に納得できなかった場合、相談は可能ですか？",
        answer:
          "はい、もちろん可能です。「他店のほうが高かった」「査定額に納得がいかない」といった場合でも、お気軽にご相談ください。再査定を行い、できる限りご満足いただける価格をご提示できるよう努めます。",
      },
      {
        question: "事前にいくらで売れるか確認できますか？",
        answer:
          "カードのお写真をLINEでお送りいただければ、無料で査定金額をご案内可能です。また、LINE査定後に必ず郵送買取を申し込む必要はございませんので、お気軽にご利用ください。",
      },
    ],
    cta: {
      headingLeading: "PSA10の買取価格を",
      headingAccent: "今すぐチェック",
      primaryButton: {
        label: "今すぐ買取価格を見る",
        href: "#",
      },
      lineButton: {
        label: "LINEで無料査定",
        href: "#",
      },
    },
    stats: { monthlyBuyback, satisfactionRate },
    renderedAt: now.toISOString(),
  };
}
