import type { FlowStep, FlowStepIcon } from "@/lib/landing/types";

type StepsProps = {
  steps: FlowStep[];
};

const stepIconClass =
  "h-[5rem] w-[5rem] max-md:h-40 max-md:w-40 max-[450px]:h-40 max-[450px]:w-48 max-[450px]:h-40 max-[450px]:w-40";

function TimelineDot() {
  return (
    <div
      className="relative z-10 flex h-[4rem] w-[4rem] items-center justify-center rounded-full border-2 border-gold bg-[#050505] max-md:h-32 max-md:w-32 max-[450px]:h-28 max-[450px]:w-28"
      aria-hidden
    >
      <span className="block h-[1.2rem] w-[1.2rem] rounded-full bg-gold max-md:h-10 max-md:w-10 max-[450px]:h-8 max-[450px]:w-8" />
    </div>
  );
}

function StepIcon({ icon }: { icon: FlowStepIcon }) {
  switch (icon) {
    case "cart":
      return (
        <svg className={stepIconClass} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M36 65.25L9 49.5V22.5L36 6.75L63 22.5V49.5L36 65.25ZM63 22.5L36 38.25M9 22.5L36 38.25M36 38.25V65.25" stroke="#141414" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "ship":
      return (
        <svg className={stepIconClass} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M47.25 47.25L39.783 39.783M39.783 39.783C40.7232 38.8428 41.469 37.7266 41.9778 36.4982C42.4867 35.2698 42.7486 33.9531 42.7486 32.6235C42.7486 31.2939 42.4867 29.9772 41.9778 28.7488C41.469 27.5204 40.7232 26.4042 39.783 25.464C38.8428 24.5238 37.7266 23.778 36.4982 23.2692C35.2698 22.7603 33.9531 22.4984 32.6235 22.4984C31.2939 22.4984 29.9772 22.7603 28.7488 23.2692C27.5204 23.778 26.4042 24.5238 25.464 25.464C23.5648 27.3632 22.4978 29.9391 22.4978 32.625C22.4978 35.3109 23.5648 37.8868 25.464 39.786C27.3632 41.6852 29.9391 42.7522 32.625 42.7522C35.3109 42.7522 37.8868 41.6852 39.786 39.786L39.783 39.783ZM63 36C63 39.5457 62.3016 43.0567 60.9447 46.3325C59.5879 49.6082 57.5991 52.5847 55.0919 55.0919C52.5847 57.5991 49.6082 59.5879 46.3325 60.9447C43.0567 62.3016 39.5457 63 36 63C32.4543 63 28.9433 62.3016 25.6675 60.9447C22.3918 59.5879 19.4153 57.5991 16.9081 55.0919C14.4009 52.5847 12.4121 49.6082 11.0553 46.3325C9.69838 43.0567 9 39.5457 9 36C9 28.8392 11.8446 21.9716 16.9081 16.9081C21.9716 11.8446 28.8392 9 36 9C43.1608 9 50.0284 11.8446 55.0919 16.9081C60.1554 21.9716 63 28.8392 63 36Z" stroke="#141414" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "assessment":
      return (
        <svg className={stepIconClass} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M27 15H21C19.4087 15 17.8826 15.6321 16.7574 16.7574C15.6321 17.8826 15 19.4087 15 21V57C15 58.5913 15.6321 60.1174 16.7574 61.2426C17.8826 62.3679 19.4087 63 21 63H51C52.5913 63 54.1174 62.3679 55.2426 61.2426C56.3679 60.1174 57 58.5913 57 57V21C57 19.4087 56.3679 17.8826 55.2426 16.7574C54.1174 15.6321 52.5913 15 51 15H45M27 15C27 16.5913 27.6321 18.1174 28.7574 19.2426C29.8826 20.3679 31.4087 21 33 21H39C40.5913 21 42.1174 20.3679 43.2426 19.2426C44.3679 18.1174 45 16.5913 45 15M27 15C27 13.4087 27.6321 11.8826 28.7574 10.7574C29.8826 9.63214 31.4087 9 33 9H39C40.5913 9 42.1174 9.63214 43.2426 10.7574C44.3679 11.8826 45 13.4087 45 15M27 42L33 48L45 36" stroke="#141414" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "approve":
      return (
        <svg className={stepIconClass} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M27 15H21C19.4087 15 17.8826 15.6321 16.7574 16.7574C15.6321 17.8826 15 19.4087 15 21V57C15 58.5913 15.6321 60.1174 16.7574 61.2426C17.8826 62.3679 19.4087 63 21 63H51C52.5913 63 54.1174 62.3679 55.2426 61.2426C56.3679 60.1174 57 58.5913 57 57V21C57 19.4087 56.3679 17.8826 55.2426 16.7574C54.1174 15.6321 52.5913 15 51 15H45M27 15C27 16.5913 27.6321 18.1174 28.7574 19.2426C29.8826 20.3679 31.4087 21 33 21H39C40.5913 21 42.1174 20.3679 43.2426 19.2426C44.3679 18.1174 45 16.5913 45 15M27 15C27 13.4087 27.6321 11.8826 28.7574 10.7574C29.8826 9.63214 31.4087 9 33 9H39C40.5913 9 42.1174 9.63214 43.2426 10.7574C44.3679 11.8826 45 13.4087 45 15M27 42L33 48L45 36" stroke="#141414" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "payment":
      return (
        <svg className={stepIconClass} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M36 18V54M27 45.546L29.637 47.523C33.15 50.16 38.847 50.16 42.363 47.523C45.879 44.886 45.879 40.614 42.363 37.977C40.608 36.657 38.304 36 36 36C33.825 36 31.65 35.34 29.991 34.023C26.673 31.386 26.673 27.114 29.991 24.477C33.309 21.84 38.691 21.84 42.009 24.477L43.254 25.467M63 36C63 39.5457 62.3016 43.0567 60.9447 46.3325C59.5879 49.6082 57.5991 52.5847 55.0919 55.0919C52.5847 57.5991 49.6082 59.5879 46.3325 60.9447C43.0567 62.3016 39.5457 63 36 63C32.4543 63 28.9433 62.3016 25.6675 60.9447C22.3918 59.5879 19.4153 57.5991 16.9081 55.0919C14.4009 52.5847 12.4121 49.6082 11.0553 46.3325C9.69838 43.0567 9 39.5457 9 36C9 28.8392 11.8446 21.9716 16.9081 16.9081C21.9716 11.8446 28.8392 9 36 9C43.1608 9 50.0284 11.8446 55.0919 16.9081C60.1554 21.9716 63 28.8392 63 36Z" stroke="#141414" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
  }
}

function StepText({ step, align }: { step: FlowStep; align: "left" | "right" }) {
  return (
    <div
      className={`flex flex-1 flex-col max-md:items-start max-md:text-left ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <p className="font-serif text-20 font-bold leading-[1.5] text-gold max-md:text-18">
        STEP {step.step}
      </p>
      <h3 className="mb-12 mt-8 text-22 font-bold leading-[1] text-white max-md:text-20 max-[450px]:text-18">
        {step.title}
      </h3>
      <p className="text-16 text-[#9CA3AF] max-[450px]:text-15">
        {step.description}
      </p>
    </div>
  );
}

export function Steps({ steps }: StepsProps) {
  return (
    <section
      id="steps"
      className="overflow-hidden border-t border-b border-[#333333] bg-background py-80"
      aria-labelledby="steps-heading"
    >
      <div className="flex flex-col items-center gap-50 max-md:mx-50 max-md:gap-40 max-[450px]:mx-15">
        <h2
          id="steps-heading"
          className="flex flex-wrap items-baseline justify-center gap-x-[0.4rem] gap-y-4 px-20 text-center leading-none max-md:px-25 max-md:leading-[1.3] max-[450px]:px-15"
        >
          <span className="font-serif text-[3.6rem] font-extrabold text-white max-md:text-[3.5rem] max-[450px]:text-[3.3rem]">
            かんたん
          </span>
          <span className="font-serif text-[4.8rem] font-extrabold leading-[0.5] text-gold max-md:text-[5rem] max-[450px]:text-[4.4rem]">
            5
          </span>
          <span className="font-serif text-[3.6rem] font-extrabold text-white max-md:text-[3.5rem] max-[450px]:text-[3.3rem]">
            ステップ！
          </span>
          <span className="title-gradient font-serif text-[3.6rem] font-extrabold max-md:block max-md:w-full max-md:text-[3.5rem] max-[450px]:text-[3.3rem]">
            買取の流れ
          </span>
        </h2>

        <div className="relative w-full px-270 max-md:px-0">
          <div
            className="pointer-events-none absolute top-0 bottom-[2rem] left-1/2 w-2 -translate-x-1/2 bg-[#333333] max-md:bottom-[0] max-md:left-16 max-md:translate-x-0 max-[450px]:left-14"
            aria-hidden
          />

          <div className="flex flex-col gap-50 max-md:gap-32 max-[450px]:gap-24">
            {steps.map((item, index) => {
              const textOnLeft = index % 2 === 0;

              return (
                <div key={item.step} className="relative">
                  <div className="relative hidden items-center gap-25 md:flex">
                    <div className="flex flex-1 justify-center">
                      {textOnLeft ? (
                        <StepText step={item} align="right" />
                      ) : (
                        <div className="steps-icon-box">
                          <StepIcon icon={item.icon} />
                        </div>
                      )}
                    </div>

                    <div className="flex w-[4rem] items-center justify-center">
                      <TimelineDot />
                    </div>

                    <div className="flex flex-1 justify-start">
                      {textOnLeft ? (
                        <div className="steps-icon-box">
                          <StepIcon icon={item.icon} />
                        </div>
                      ) : (
                        <StepText step={item} align="left" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-12 md:hidden max-md:gap-30 max-[450px]:gap-18">
                    <div className="flex w-[4rem] justify-center max-md:w-32 max-md:h-32 max-[450px]:w-28">
                      <TimelineDot />
                    </div>
                    <div className="flex flex-1 flex-col gap-12 max-md:flex-row max-md: gap-20 max-[450px]:gap-15">
                      <div className="steps-icon-box w-fit max-md:p-10 max-[450px]:p-86">
                        <StepIcon icon={item.icon} />
                      </div>
                      <StepText step={item} align="left" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
