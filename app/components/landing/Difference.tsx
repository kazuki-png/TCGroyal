import type { LandingPageData } from "@/lib/landing/types";

type DifferenceProps = {
  content: LandingPageData["difference"];
};

function DifferenceCellText({ text }: { text: string }) {
  const lines = text.split("\n");

  if (lines.length === 1) {
    return text;
  }

  return (
    <>
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 && (
            <>
              <br className="hidden max-[450px]:block" />
              <span className="max-[450px]:hidden"> </span>
            </>
          )}
          {line}
        </span>
      ))}
    </>
  );
}

export function Difference({ content }: DifferenceProps) {
  return (
    <section
      id="difference"
      className="bg-[var(--lp-background)] py-80 max-md:overflow-hidden max-md:py-60"
      aria-labelledby="difference-heading"
    >
      <div className="flex flex-col gap-50 px-[250px] max-md:px-25 max-md:gap-40 max-[450px]:px-15">
        <div className="relative text-center">
          <h2
            id="difference-heading"
            className="section-title"
          >
            <span className="text-white">{content.heading}</span>
            <span className="section-title-accent">
              {content.headingAccent}
            </span>
          </h2>
        </div>

        <div className="compare-table-wrap">
          <table className="compare-table w-full">
            <colgroup>
              <col className="compare-table__col-label" />
              <col className="compare-table__col-royal" />
              <col className="compare-table__col-rival" />
              <col className="compare-table__col-rival" />
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="compare-table__cell compare-table__head compare-table__label"
                >
                  比較項目
                </th>
                <th
                  scope="col"
                  aria-label="TCG ROYAL"
                  className="compare-table__cell compare-table__head compare-table__royal compare-table__royal-head"
                />
                <th
                  scope="col"
                  className="compare-table__cell compare-table__head compare-table__rival"
                >
                  他社A
                </th>
                <th
                  scope="col"
                  className="compare-table__cell compare-table__head compare-table__rival"
                >
                  他社B
                </th>
              </tr>
            </thead>
            <tbody>
              {content.items.map((item) => (
                <tr key={item.label}>
                  <th scope="row" className="compare-table__cell compare-table__label font-medium">
                    <DifferenceCellText text={item.label} />
                  </th>
                  <td className="compare-table__cell compare-table__royal">
                    <DifferenceCellText text={item.tcgRoyal} />
                  </td>
                  <td className="compare-table__cell compare-table__rival">
                    <DifferenceCellText text={item.companyA} />
                  </td>
                  <td className="compare-table__cell compare-table__rival">
                    <DifferenceCellText text={item.companyB} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
