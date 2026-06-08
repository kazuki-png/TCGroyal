type PriceBulletListProps = {
  bullets: string[];
  className?: string;
};

export function PriceBulletList({
  bullets,
  className = "",
}: PriceBulletListProps) {
  return (
    <ul
      className={`flex w-fit flex-col items-start gap-8 text-left text-18 font-medium leading-[1.4] text-[#9CA3AF] max-md:text-18 max-[450px]:text-16 ${className}`.trim()}
    >
      {bullets.map((bullet) => (
        <li key={bullet} className="flex items-center gap-8">
          <span className="text-[var(--lp-gold)]">・</span>
          {bullet}
        </li>
      ))}
    </ul>
  );
}
