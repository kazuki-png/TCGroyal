type CtaLineIconProps = {
  className?: string;
};

export function CtaLineIcon({ className = "w-[20px]" }: CtaLineIconProps) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M28 10.9011C28 4.89083 21.7198 0 14 0C6.28133 0 0 4.89083 0 10.9011C0 16.2901 4.6095 20.8551 11.011 21.6488C12.2897 21.8223 13.4785 22.3765 14.077 23.4623C14.3022 23.8698 14.413 24.3086 14.3582 24.7374L13.965 27.0154C13.8647 27.5953 14.2438 28.0867 14.8178 27.9871C18.9163 27.274 28 20.7835 28 10.9011Z"
        fill="white"
      />
    </svg>
  );
}
