import Image from "next/image";
import { PriceBulletList } from "@/app/components/landing/price/PriceBulletList";
import type { LandingPageData } from "@/lib/landing/types";

type PriceProps = {
  content: LandingPageData["whyHighPrice"];
};

export function Price({ content }: PriceProps) {
  return (
    <section
      id="price"
      className="bg-background py-80 border-t border-b border-[#333333] max-md:overflow-hidden max-md:py-60"
    >
      <div className="relative flex flex-col items-center gap-50 mx-250 max-md:mx-auto max-md:gap-40 max-md:px-40 max-[450px]:gap-32 max-[450px]:px-15">
        <div className="relative flex justify-center w-full">
          <h2 className="section-title">
            なぜ<span className="title-gradient">高価買取</span>が可能なのか？
          </h2>
          <div
            className="pointer-events-none absolute top-[-4rem] right-[6rem] w-[15.4rem] h-[11rem] max-md:top-[-4rem] max-md:right-0 max-md:h-[10rem] max-md:w-[13rem] max-[450px]:hidden"
            aria-hidden
          >
            <Image
              src="/lp/images/price_coin.png"
              alt=""
              fill
              sizes="(max-width: 450px) 0px, (max-width: 768px) 13rem, 20.5rem"
              className="object-contain"
            />
          </div>
        </div>

        <div className="relative flex flex-col items-center w-full gap-30 rounded-[1.6rem] border-2 border-[#333333] bg-[#050505] px-50 py-30 max-md:gap-24 max-md:rounded-[1.2rem] max-md:px-40 max-md:py-25 max-[450px]:gap-20 max-[450px]:px-30">
          <div className="relative w-[20rem] h-[16rem] max-md:h-[16rem] max-md:w-[19rem] max-[450px]:h-[12rem] max-[450px]:w-[14rem]">
            <Image
              src="/lp/images/price_earth.png"
              alt=""
              fill
              sizes="(max-width: 450px) 14rem, (max-width: 768px) 19rem, 24rem"
              className="object-contain"
            />
          </div>

          <div className="flex flex-col items-center gap-30 max-md:gap-24 max-[450px]:gap-20">
            <h3 className="font-serif text-28 font-bold leading-[1] text-[#D1D5DB] max-md:text-24">
              多方面の販路を保有
            </h3>

            <div className="flex flex-col gap-20 max-md:gap-16 max-[450px]:gap-12">
              <p className="text-18 font-medium max-[450px]:text-16">
                当社は単一の販売先に依存せず、複数の強力な販路を保有しています。
              </p>

              <PriceBulletList bullets={content.bullets} />

              <p className="text-18 font-medium max-[450px]:text-16">
                常に世界中で最も高く売れる市場を選択できるため、カードの価値を
                <br className="max-md:hidden" />
                最大限に評価した買取価格のご提示が可能です。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
