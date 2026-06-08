import { CtaLineButton } from "@/app/components/landing/cta/CtaLineButton";
import { CtaPrimaryButton } from "@/app/components/landing/cta/CtaPrimaryButton";
import type { LandingPageData } from "@/lib/landing/types";

type CtaProps = {
  content: LandingPageData["cta"];
};

const ctaButtonResponsiveClass =
  "max-md:py-18 max-md:text-20 max-[450px]:text-18";

export function Cta({ content }: CtaProps) {
  return (
    <section
      id="cta"
      className="border-t-1 border-[#D4AF374D] bg-[linear-gradient(180deg,#0F0E0B_0%,#1A1705_100%)] py-80 max-md:py-60"
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto flex w-full max-w-full flex-col items-center gap-50 px-20 max-md:gap-40 max-md:px-50 max-[450px]:px-15">
        <div className="w-full text-center">
          <div className="inline-flex items-center justify-center gap-x-8 gap-y-8">
            <h2
              id="cta-heading"
              className="section-title w-fit text-center"
            >
              <span className="text-white max-[450px]:block">{content.headingLeading}</span>
              <span className="section-title-accent max-[450px]:block">
                {content.headingAccent}
              </span>
            </h2>
            <span
              className="inline-flex h-[5rem] w-[5rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-white max-md:h-50 max-md:w-50 max-[450px]:hidden"
              aria-hidden
            >
              <svg
                className="w-[3rem] max-md:w-26"
                viewBox="0 0 53 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 22.8692L16.7976 35.4487L48.7917 4"
                  stroke="#D4AF37"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-56 max-md:gap-40 max-[450px]:gap-32">
          <div className="flex w-[40rem] max-w-full flex-col gap-20 max-md:w-[32rem] max-[450px]:gap-12">
            <CtaPrimaryButton className={`w-full ${ctaButtonResponsiveClass}`} />
            <CtaLineButton className={`w-full ${ctaButtonResponsiveClass}`} />
          </div>
        </div>
      </div>
    </section>
  );
}
