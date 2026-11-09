import Link from "next/link";

export const metadata = { title: "How it works — LandFlow" };

const STEPS = [
  {
    n: "01",
    title: "Browse the marketplace",
    body: "Every listing on LandFlow is posted by the person who owns the land. Filter by region, type and price to find what you are looking for. There is no account needed to browse.",
    points: [
      "Search across every region of Uganda",
      "Filter by land type and maximum price",
      "Save listings to come back to later",
    ],
  },
  {
    n: "02",
    title: "Send an enquiry",
    body: "Found something? Send the seller a message straight from the listing. Your name, email and question go to the owner — and nowhere else. No agents, no forms in the dark.",
    points: [
      "No account required to ask a question",
      "Your details go only to the seller",
      "You can see every enquiry you have sent",
    ],
  },
  {
    n: "03",
    title: "View it and check the title",
    body: "Agree a time to walk the land with the seller. Before you pay anybody, read the land title at the Lands office and make sure the name on it matches the name of the person selling you.",
    points: [
      "Always walk the boundaries",
      "Read the title before paying a deposit",
      "Never pay someone you have not met",
    ],
  },
];

export default function HowItWorks() {
  return (
    <main className="page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">How it works</p>
        <h1 className="mt-3 page-title">A land marketplace without the middlemen</h1>
        <p className="lede">
          LandFlow exists for one reason: to put a buyer and the person who owns
          the land in the same room, quickly, with the facts in writing.
        </p>
      </div>

      <ol className="mx-auto mt-12 max-w-3xl space-y-6">
        {STEPS.map((step) => (
          <li key={step.n} className="card card-pad">
            <div className="flex gap-5">
              <span className="font-mono text-lg font-bold text-brand-600">
                {step.n}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {step.title}
                </h2>
                <p className="mt-2 leading-relaxed text-ink-500">{step.body}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-ink-500">
                  {step.points.map((point) => (
                    <li key={point}>· {point}</li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center">
        <h2 className="text-xl font-bold text-brand-900">
          Own land you want to sell?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-brand-800">
          Posting is free and takes about two minutes. You decide who to reply
          to and when.
        </p>
        <Link href="/list-your-land" className="btn btn-primary mt-6">
          Post your land
        </Link>
      </div>
    </main>
  );
}
