import Image from "next/image";
import type { Reason as ReasonItem, ReasonIcon } from "@/lib/landing/types";
import { BRAND_NAME } from "@/lib/brand";

type ReasonProps = {
  reasons: ReasonItem[];
};

function ReasonIconGraphic({ icon }: { icon: ReasonIcon }) {
  const className = "h-[4.2rem] w-[4.2rem] max-md:h-32 max-md:w-32 max-[450px]:h-28 max-[450px]:w-28";

  switch (icon) {
    case "medal":
      return (
        <svg className={className} viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 24.5C26.799 24.5 31.5 19.799 31.5 14C31.5 8.20101 26.799 3.5 21 3.5C15.201 3.5 10.5 8.20101 10.5 14C10.5 19.799 15.201 24.5 21 24.5Z" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M27.0847 22.5576L29.75 38.5001L21 33.2501L12.25 38.5001L14.9152 22.5576" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "globe":
      return (
        <svg className={className} viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 38.5C30.665 38.5 38.5 30.665 38.5 21C38.5 11.335 30.665 3.5 21 3.5C11.335 3.5 3.5 11.335 3.5 21C3.5 30.665 11.335 38.5 21 38.5Z" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 21C14 14.4843 16.5064 8.21827 21 3.5C25.4936 8.21827 28 14.4843 28 21C28 27.5157 25.4936 33.7817 21 38.5C16.5064 33.7817 14 27.5157 14 21Z" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3.5 21H38.5" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "shield":
      return (
        <svg className={className} viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M35 22.75C35 31.5 28.875 35.875 21.595 38.4125C21.2138 38.5417 20.7997 38.5355 20.4225 38.395C13.125 35.875 7 31.5 7 22.75V10.5C7 10.0359 7.18437 9.59075 7.51256 9.26256C7.84075 8.93437 8.28587 8.75 8.75 8.75C12.25 7 15.75 5.25 21 5.25C25.375 5.25 28.875 7 31.5 8.75C31.9641 8.75 32.4092 8.93437 32.7374 9.26256C33.0656 9.59075 33.25 10.0359 33.25 10.5L35 22.75Z" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M15.75 21L19.25 24.5L26.25 17.5" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "lightning":
      return (
        <svg className={className} viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.75 3.5L5.25 24.5H21L19.25 38.5L36.75 17.5H21L22.75 3.5Z" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "phone":
      return (
        <svg className={className} viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M29.75 3.5H12.25C10.317 3.5 8.75 5.067 8.75 7V35C8.75 36.933 10.317 38.5 12.25 38.5H29.75C31.683 38.5 33.25 36.933 33.25 35V7C33.25 5.067 31.683 3.5 29.75 3.5Z" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 31.5H21.0175" stroke="#141414" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
  }
}

function ReasonTitle({ title }: { title: string }) {
  const lineBreakIndex = title.indexOf("\n");

  if (lineBreakIndex === -1) {
    return title;
  }

  const firstLine = title.slice(0, lineBreakIndex);
  const secondLine = title.slice(lineBreakIndex + 1);

  return (
    <>
      {firstLine}<br className="max-md:hidden" /><span className="max-md:hidden">{secondLine}</span><span className="hidden max-md:inline">{` ${secondLine}`}</span>
    </>
  );
}

function ReasonCard({ reason }: { reason: ReasonItem }) {
  return (
    <div className="flex flex-col gap-14 px-20 py-25 border border-[#B3905466] bg-[#141414] max-md:gap-12 max-md:px-16 max-md:py-24 max-[450px]:gap-10 max-[450px]:px-15 max-[450px]:py-20">

      <div className="flex items-start gap-15 max-md:gap-12 max-[450px]:gap-10">
        <div
          className="flex h-[6.4rem] w-[6.4rem] items-center justify-center rounded-full bg-[#CCA766] max-md:h-50 max-md:w-50 max-[450px]:h-44 max-[450px]:w-44"
        >
          <ReasonIconGraphic icon={reason.icon} />
        </div>

        <div className="flex flex-1 flex-col gap-12 max-md:gap-8 max-[450px]:gap-6">

          <p className="font-serif text-20 font-semibold leading-[1] text-[#B39054] max-md:text-18 max-[450px]:text-16">
            Reason.{reason.number}
          </p>

          <h3 className="font-serif text-22 font-bold leading-[1.3] text-white max-md:text-22 max-[450px]:text-[1.9rem]">
            <ReasonTitle title={reason.title} />
          </h3>

        </div>
        
      </div>

      <p className="font-serif text-16 pl-30 pr-10 text-[#9CA3AF] max-md:pl-25 max-md:pr-15 max-md:text-18 max-[450px]:text-16">
          {reason.description}
      </p>
    </div>
  );
}

export function Reason({ reasons }: ReasonProps) {
  return (
    <section
      id="reasons"
      className="relative overflow-hidden bg-background py-80 max-md:py-60"
      aria-labelledby="reasons-heading"
    >
      <div className="relative flex flex-col items-center gap-50 px-180 max-md:gap-40 max-md:px-25 max-[450px]:gap-32 max-[450px]:px-15">
        <h2
          id="reasons-heading"
          className="relative z-10 font-serif text-[3.6rem] font-bold leading-[1] text-center text-white max-md:text-[3.3rem] max-md:leading-[1.2] max-[450px]:text-[2.6rem]"
        >
          {BRAND_NAME}郵送買取が選ばれる<br />
          <span className="text-[6rem] leading-[1] text-gold title-gradient max-md:text-[4.2rem] max-[450px]:text-[3.6rem]">5</span>つの理由
        </h2>

        <div className="relative z-10 grid w-full grid-cols-2 gap-y-14 gap-x-20 max-md:grid-cols-1 max-md:gap-y-12 max-[450px]:gap-y-10">
          {reasons.map((reason) => (
            <ReasonCard key={reason.number} reason={reason} />
          ))}
        </div>

        <div
          className="pointer-events-none absolute top-[-3rem] h-[24rem] w-[18rem] left-[58%] -translate-x-1/2 max-md:top-[-4rem] max-md:h-[20rem] max-md:w-[14rem] max-md:left-auto max-md:right-0 max-md:translate-x-0 max-[450px]:hidden"
          aria-hidden
        >
          <Image
            src="/lp/images/star.png"
            alt=""
            fill
            sizes="(max-width: 450px) 0px, (max-width: 768px) 14rem, 25rem"
            className="object-contain opacity-68"
          />
        </div>

        <div className="absolute top-[-8rem] right-[0] h-[25.6rem] w-[25.6rem] rounded-full bg-[#A68A281A] blur-[8rem] max-md:h-[16rem] max-md:w-[16rem] max-md:blur-[5rem] max-[450px]:hidden" />
        <div className="absolute bottom-[-8rem] left-0 h-[25.6rem] w-[25.6rem] rounded-full bg-[#A0A0A01A] blur-[8rem] max-md:h-[16rem] max-md:w-[16rem] max-md:blur-[5rem] max-[450px]:hidden" />

      </div>
    </section>
  );
}
