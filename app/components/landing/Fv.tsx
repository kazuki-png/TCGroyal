import Image from "next/image";
import { CtaLineButton } from "@/app/components/landing/cta/CtaLineButton";
import { CtaPrimaryButton } from "@/app/components/landing/cta/CtaPrimaryButton";
import type { FvHighlightIcon, LandingPageData } from "@/lib/landing/types";

type FvProps = {
  fv: LandingPageData["fv"];
};

const fvCtaButtonClass = "max-md:py-18 max-md:text-18 max-[450px]:text-16";

function FvHighlightIconGraphic({ icon }: { icon: FvHighlightIcon }) {
  switch (icon) {
    case "noReduction":
      return (
        <span className="relative h-[25px] w-[30px] max-md:h-[25px] max-md:w-[30px] max-[450px]:h-[25px] max-[450px]:w-[20px]">
          <Image src="/lp/images/banner_icon01.png" alt="基本減額なし" fill sizes="(max-width: 768px) 30px, 25px" className="object-contain" />
        </span>
      );
    case "sameDay":
      return (
        <span className="relative h-[25px] w-[25px] max-md:h-[25px] max-md:w-[25px] max-[450px]:h-[20px] max-[450px]:w-[20px]">
          <Image src="/lp/images/banner_icon02.png" alt="最短当日査定・振込" fill sizes="(max-width: 768px) 25px, 25px" className="object-contain" />
        </span>
      );
    case "freeShipping":
      return (
        <span className="relative h-[20px] w-[25px] max-md:h-[30px] max-md:w-[25px] max-[450px]:h-[20px] max-[450px]:w-[20px]">
          <Image src="/lp/images/banner_icon03.png" alt="送料無料" fill sizes="(max-width: 768px) 25px, 30px" className="object-contain" />
        </span>
      );
  }
}

export function Fv({ fv }: FvProps) {
  return (
    <section
      id="fv"
      className="relative overflow-hidden bg-[var(--lp-background)] pb-60 max-md:pb-60"
    >
      <div className="relative flex w-full flex-col items-center max-md:px-25 max-[450px]:px-15">

        <span className="bg-black rounded-[6px] border-[3px] border-[#C5A059] px-30 py-10 text-16 leading-[1] font-[900] tracking-[0.04em] text-[#C5A059] drop-shadow-[4px_4px_8px_#C5A05975] max-md:px-35 max-md:py-10 max-[450px]:border-2 max-[450px]:text-18">
          {fv.badge}
        </span>

        <div className="relative z-10 mt-15 flex flex-col items-center gap-20 text-center max-md:gap-15 max-[450px]:mt-5">
          
          <h1 className="fv-title flex flex-col items-center text-center">
            <span className="fv-title-stroke" aria-hidden>
              {fv.title}
            </span>
            <span className="fv-title-fill">{fv.title}</span>
          </h1>
          <p className="fv-description">
            <span className="fv-description-stroke" aria-hidden>
              {fv.description}
            </span>
            <span className="fv-description-fill">{fv.description}</span>
          </p>
        </div>

        <div className="mt-25 mb-20 flex w-full justify-center gap-30 max-md:mt-20 max-md:mb-20 max-md:gap-16 max-[450px]:gap-8">
          {fv.highlights.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-15 rounded-[12px] border-2 border-[#D4AF37] px-30 py-8 max-md:gap-12 max-md:px-20 max-md:py-6 max-[450px]:justify-center max-[450px]:gap-8 max-[450px]:px-10 max-[450px]:gap-8"
            >
              <FvHighlightIconGraphic icon={item.icon} />
              <p className="text-15 font-bold leading-[1] text-[var(--lp-gold)] max-[450px]:text-13">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        <div className="relative mb-30 flex w-full items-center justify-center max-md:mb-40 max-[450px]:mb-25">
          <div className="relative flex items-end justify-center">
            <div className="relative z-10 w-[110px] aspect-[22/30.8] max-md:w-[100px]">
              <Image
                src={`${fv.cards.left}?v=${fv.cardAssetVersion}`}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 450px) 120px, (max-width: 768px) 140px, 220px"
                className="-rotate-6 rounded-[8px] object-contain shadow-[0_0_30px_0_#D4AF3780] max-md:-rotate-4 max-[450px]:-rotate-3"
              />
            </div>
            <div className="relative z-20 w-[170px] aspect-[30/42] max-md:w-[160px]">
              <Image
                src={`${fv.cards.center}?v=${fv.cardAssetVersion}`}
                alt="PSA10 高価買取対象カード"
                fill
                unoptimized
                sizes="(max-width: 450px) 170px, (max-width: 768px) 200px, 300px"
                className="rounded-[8px] object-contain shadow-[0_0_40px_0_#D4AF3780]"
                priority
              />
            </div>
            <div className="relative z-10 w-[110px] aspect-[22/30.8] max-md:w-[100px]">
              <Image
                src={`${fv.cards.right}?v=${fv.cardAssetVersion}`}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 450px) 120px, (max-width: 768px) 140px, 220px"
                className="rotate-6 rounded-[8px] object-contain shadow-[0_0_30px_0_#D4AF3780] max-md:rotate-4 max-[450px]:rotate-3"
              />
            </div>
          </div>
        </div>

        <div className="flex w-full justify-center gap-30 px-400 max-md:gap-20 max-md:w-[90%] max-md:px-0 max-[450px]:gap-10 max-[450px]:w-full">
          <CtaLineButton
            className={`flex-1 ${fvCtaButtonClass}`}
          />
          <CtaPrimaryButton
            className={`flex-1 ${fvCtaButtonClass}`}
          />
        </div>

        <div className="absolute top-[50px] right-[410px] h-[240px] w-[150px] max-md:top-[70px] max-md:right-[50px] max-md:h-[200px] max-md:w-[140px] max-[450px]:hidden">
          <Image
            src="/lp/images/star.png"
            alt=""
            fill
            sizes="(max-width: 450px) 0px, (max-width: 768px) 140px, 250px"
            className="object-contain opacity-70"
          />
        </div>
      </div>
    </section>
  );
}
