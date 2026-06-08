import { CtaLineIcon } from "@/app/components/landing/cta/CtaLineIcon";

type CtaLineButtonProps = {
  className?: string;
};

export function CtaLineButton({
  className = "",
}: CtaLineButtonProps) {
  return (
    <a
      href="https://lin.ee/Q6CsfJkl"
      target="_blank"
      rel="noopener noreferrer"
      className={`relative cta-line-button flex items-center justify-center gap-10 rounded-full bg-[var(--lp-line-green)] py-20 text-18 font-bold text-white ${className}`.trim()}
    >
      <CtaLineIcon className="cta-line-button__icon w-[20px] max-md:w-[20px]" />
      <span className="leading-none text-inherit">LINEで無料査定</span>
    </a>
  );
}
