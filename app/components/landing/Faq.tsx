import Image from "next/image";
import type { FaqItem } from "@/lib/landing/types";

type FaqProps = {
  items: FaqItem[];
};

export function Faq({ items }: FaqProps) {
  return (
    <section
      id="faq"
      className="bg-[var(--lp-background)] py-80 max-md:overflow-hidden max-md:py-60"
      aria-labelledby="faq-heading"
    >
      <div className="relative flex flex-col items-center mx-360 gap-50 max-md:mx-auto max-md:ml-0 max-md:mr-0 max-md:gap-40 max-md:px-25 max-[450px]:gap-32 max-[450px]:px-15">
        <div className="w-full text-center">
          <h2
            id="faq-heading"
            className="section-title mx-auto w-fit text-center max-md:text-36 max-[450px]:text-28"
          >
            <span className="text-white">よくある</span>
            <span className="section-title-accent">ご質問</span>
          </h2>
        </div>

        <div className="flex w-full flex-col gap-20 max-md:gap-16 max-[450px]:gap-12">
          {items.map((item, index) => (
            <div
              key={`faq-${index}`}
              className="flex flex-col faq-item px-30 py-28 border border-[#333333] gap-15 rounded-[12px] bg-[#121212] max-md:gap-12 max-md:px-24 max-md:py-24 max-[450px]:gap-10 max-[450px]:rounded-[10px] max-[450px]:px-20 max-[450px]:py-20"
            >
              <div className="flex items-center gap-10 text-20 font-bold leading-[1.5] text-white max-md:gap-8 max-md:text-18 max-[450px]:items-start max-[450px]:gap-6 max-[450px]:text-18">
                <span className="text-[var(--lp-gold)] font-sans">Q.</span>
                <p>{item.question}</p>
              </div>
              <div className="flex items-start gap-10 text-16 font-normal leading-[1.6] pl-20 max-md:gap-8 max-md:pl-16 max-md:text-16 max-[450px]:gap-6 max-[450px]:pl-12 max-[450px]:text-16">
                <span className="text-[#6B7280] font-sans">A.</span>
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute top-[-18px] right-[-100px] h-[140px] w-[180px] max-md:top-[-10px] max-md:right-0 max-md:h-[120px] max-md:w-[146px] max-[450px]:hidden">
          <Image
            src="/lp/images/faq-qa.png"
            alt=""
            fill
            sizes="(max-width: 450px) 0px, (max-width: 768px) 146px, 224px"
            className="object-contain"
          />
        </div>
      </div>
    </section>
  );
}
