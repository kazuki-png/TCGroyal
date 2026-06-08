export type SolutionIcon = "warning" | "clock" | "shield" | "question" | "globe";

export type SolutionItem = {
  text: string;
  icon: SolutionIcon;
};

export type SolutionSection = {
  items: SolutionItem[];
  closingBefore: string;
  closingBrand: string;
  closingAfter: string;
};

export type ReasonIcon = "medal" | "globe" | "shield" | "lightning" | "phone";

export type Reason = {
  number: number;
  title: string;
  description: string;
  icon: ReasonIcon;
};

export type Differentiator = {
  label: string;
  tcgRoyal: string;
  companyA: string;
  companyB: string;
};

export type FlowStepIcon = "cart" | "ship" | "assessment" | "approve" | "payment";

export type FlowStep = {
  step: number;
  title: string;
  description: string;
  icon: FlowStepIcon;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type FvHighlightIcon = "noReduction" | "sameDay" | "freeShipping";

export type FvHighlight = {
  label: string;
  icon: FvHighlightIcon;
};

export type LandingPageData = {
  fv: {
    badge: string;
    title: string;
    description: string;
    highlights: FvHighlight[];
    /** Bump when replacing banner_card*.png so Next.js serves fresh files */
    cardAssetVersion: string;
    cards: {
      left: string;
      center: string;
      right: string;
    };
  };
  solution: SolutionSection;
  fiveReasons: Reason[];
  whyHighPrice: {
    heading: string;
    cardTitle: string;
    intro: string;
    bullets: string[];
    closing: string;
  };
  difference: {
    heading: string;
    headingAccent: string;
    items: Differentiator[];
  };
  fiveSteps: FlowStep[];
  faq: FaqItem[];
  cta: {
    headingLeading: string;
    headingAccent: string;
    primaryButton: {
      label: string;
      href: string;
    };
    lineButton: {
      label: string;
      href: string;
    };
  };
  stats: {
    monthlyBuyback: number;
    satisfactionRate: number;
  };
  renderedAt: string;
};
