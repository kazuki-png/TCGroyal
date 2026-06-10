import Image from "next/image";
import type { SolutionIcon, SolutionItem, SolutionSection } from "@/lib/landing/types";

type SolutionProps = {
  content: SolutionSection;
};

function SolutionIconGraphic({ icon }: { icon: SolutionIcon }) {
  const className = "h-full w-full";

  switch (icon) {
    case "warning":
      return (
        <svg className={className} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24.5 19.4996V23.9997M24.5 32.9999H24.5218M9.37349 42H39.6265C42.9889 42 45.0893 38.2492 43.4081 35.2499L28.2816 8.24947C26.6004 5.25018 22.3996 5.25018 20.7184 8.24947L5.59187 35.2499C3.91066 38.2492 6.01108 42 9.37349 42Z" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "clock":
      return (
        <svg className={className} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M25 16.6667V25L31.25 31.25M43.75 25C43.75 27.4623 43.265 29.9005 42.3227 32.1753C41.3805 34.4502 39.9993 36.5172 38.2582 38.2582C36.5172 39.9993 34.4502 41.3805 32.1753 42.3227C29.9005 43.265 27.4623 43.75 25 43.75C22.5377 43.75 20.0995 43.265 17.8247 42.3227C15.5498 41.3805 13.4828 39.9993 11.7417 38.2582C10.0006 36.5172 8.61953 34.4502 7.67726 32.1753C6.73498 29.9005 6.25 27.4623 6.25 25C6.25 20.0272 8.22544 15.2581 11.7417 11.7417C15.2581 8.22544 20.0272 6.25 25 6.25C29.9728 6.25 34.7419 8.22544 38.2582 11.7417C41.7746 15.2581 43.75 20.0272 43.75 25Z" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "shield":
      return (
        <svg className={className} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.75 25L22.9167 29.1666L31.25 20.8333M42.9542 12.4666C36.3669 12.8165 29.9099 10.5387 25 6.1333C20.0901 10.5387 13.6331 12.8165 7.04584 12.4666C6.5157 14.519 6.24829 16.6303 6.25001 18.75C6.25001 30.3979 14.2167 40.1875 25 42.9625C35.7833 40.1875 43.75 30.4 43.75 18.75C43.75 16.5791 43.4729 14.475 42.9542 12.4666Z" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "question":
      return (
        <svg className={className} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.75 25L22.9167 29.1666L31.25 20.8333M42.9542 12.4666C36.3669 12.8165 29.9099 10.5387 25 6.1333C20.0901 10.5387 13.6331 12.8165 7.04584 12.4666C6.5157 14.519 6.24829 16.6303 6.25001 18.75C6.25001 30.3979 14.2167 40.1875 25 42.9625C35.7833 40.1875 43.75 30.4 43.75 18.75C43.75 16.5791 43.4729 14.475 42.9542 12.4666Z" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "globe":
      return (
        <svg className={className} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6.36458 22.9167H10.4167C11.5217 22.9167 12.5815 23.3557 13.3629 24.1371C14.1443 24.9185 14.5833 25.9783 14.5833 27.0833V29.1667C14.5833 30.2717 15.0223 31.3315 15.8037 32.1129C16.5851 32.8943 17.6449 33.3333 18.75 33.3333C19.8551 33.3333 20.9149 33.7723 21.6963 34.5537C22.4777 35.3351 22.9167 36.3949 22.9167 37.5V43.6354M16.6667 8.19792V11.4583C16.6667 12.8397 17.2154 14.1644 18.1922 15.1412C19.1689 16.1179 20.4937 16.6667 21.875 16.6667H22.9167C24.0217 16.6667 25.0815 17.1057 25.8629 17.8871C26.6443 18.6685 27.0833 19.7283 27.0833 20.8333C27.0833 21.9384 27.5223 22.9982 28.3037 23.7796C29.0851 24.561 30.1449 25 31.25 25C32.3551 25 33.4149 24.561 34.1963 23.7796C34.9777 22.9982 35.4167 21.9384 35.4167 20.8333C35.4167 19.7283 35.8557 18.6685 36.6371 17.8871C37.4185 17.1057 38.4783 16.6667 39.5833 16.6667H41.8M31.25 42.6833V37.5C31.25 36.3949 31.689 35.3351 32.4704 34.5537C33.2518 33.7723 34.3116 33.3333 35.4167 33.3333H41.8M43.75 25C43.75 27.4623 43.265 29.9005 42.3227 32.1753C41.3805 34.4502 39.9993 36.5172 38.2582 38.2582C36.5172 39.9993 34.4502 41.3805 32.1753 42.3227C29.9005 43.265 27.4623 43.75 25 43.75C22.5377 43.75 20.0995 43.265 17.8247 42.3227C15.5498 41.3805 13.4828 39.9993 11.7417 38.2582C10.0006 36.5172 8.61953 34.4502 7.67726 32.1753C6.73498 29.9005 6.25 27.4623 6.25 25C6.25 20.0272 8.22544 15.2581 11.7417 11.7417C15.2581 8.22544 20.0272 6.25 25 6.25C29.9728 6.25 34.7419 8.22544 38.2582 11.7417C41.7746 15.2581 43.75 20.0272 43.75 25Z" stroke="#D4AF37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
  }
}

function SolutionCard({ item }: { item: SolutionItem }) {
  return (
    <div className="flex items-center gap-16 rounded-[1.2rem] border-2 border-[#333333] bg-[#050505] px-20 py-15 max-md:gap-12 max-md:p-16 max-[450px]:gap-10 max-[450px]:rounded-[1rem] max-[450px]:p-15">
      <div
        className="flex h-[3.6rem] w-[3.6rem] items-center justify-center max-md:h-[3.5rem] max-md:w-[3.5rem]"
        aria-hidden
      >
        <SolutionIconGraphic icon={item.icon} />
      </div>
      <p className="flex-1 text-18 font-medium leading-[1.3] max-md:text-16 max-md:leading-[1.4] max-[450px]:text-[1.5rem] max-[450px]:leading-[1.5]">{item.text}</p>
    </div>
  );
}

export function Solution({ content }: SolutionProps) {
  return (
    <section
      id="solution"
      className="bg-background py-80 border-t border-b border-[#333333] max-md:overflow-hidden max-md:py-60"
      aria-labelledby="solution-heading"
    >
      <div className="relative flex flex-col items-center gap-60 mx-200 max-md:mx-auto max-md:gap-45 max-md:px-25 max-[450px]:gap-40 max-[450px]:px-15">
        <div className="relative flex w-full justify-center">
          <h2
            id="solution-heading"
            className="section-title relative z-10"
          >
            こんな<span className="title-gradient">お悩み</span>ありませんか
          </h2>
          <div
            className="pointer-events-none absolute top-[-3.5rem] right-[20rem] h-[11rem] w-[7rem] max-md:top-[-3rem] max-md:right-[8rem] max-md:h-[9rem] max-md:w-[6rem] max-[450px]:top-[-2rem] max-[450px]:right-[-1rem] max-[450px]:w-[5rem] max-[450px]:h-[7rem]"
            aria-hidden
          >
            <Image
              src="/lp/images/solution_mark.png"
              alt=""
              fill
              sizes="(max-width: 450px) 5rem, (max-width: 768px) 7rem, 11rem"
              className="object-contain"
            />
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-20 max-md:grid-cols-1 max-md:gap-12 max-[450px]:gap-10">
          {content.items.map((item, index) => (
            <SolutionCard key={`${item.icon}-${index}`} item={item} />
          ))}
        </div>

        <p className="text-center font-serif text-30 font-bold leading-[1] text-white max-md:text-[2.6rem] max-md:leading-[1.3] max-[450px]:text-[2.4rem] max-[450px]:leading-[1.5]">
          {content.closingBefore}
          <span className="title-gradient text-40 font-[800] leading-[0.75] max-md:text-[3.6rem] max-[450px]:text-[3rem]">{content.closingBrand}</span><br className="hidden max-[450px]:block" />
          {content.closingAfter}
        </p>
      </div>
    </section>
  );
}
