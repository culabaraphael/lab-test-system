import { COPY } from "./lifestyleCopy";

const SECTIONS = ["food", "routine", "avoid"];

/**
 * Lifestyle tips (daily food, daily routine, what to avoid) taken from the
 * cited sources of the retrieved knowledge base entries. The AI does not
 * write these; the Bisaya version is an AI translation of the same lines.
 */
export default function LifestyleTips({
  lifestyle,
  lifestyleCeb,
  lang = "en",
  className = "mt-3",
}) {
  if (!lifestyle) {
    return null;
  }

  const hasContent = [...SECTIONS, "notes"].some(
    (key) => (lifestyle[key] || []).length > 0
  );

  if (!hasContent) {
    return null;
  }

  // Use the Bisaya tips only when they actually contain lines; otherwise show
  // the English tips with the "English only" note instead of an empty list.
  const cebHasContent =
    !!lifestyleCeb &&
    [...SECTIONS, "notes"].some((key) => (lifestyleCeb[key] || []).length > 0);
  const useCeb = lang === "ceb" && cebHasContent;
  const t = COPY[useCeb ? "ceb" : "en"];
  const data = useCeb ? lifestyleCeb : lifestyle;
  const sources = lifestyle.sources || [];

  return (
    <div className={className}>
      {lang === "ceb" && !useCeb && (
        <p className="text-xs text-blue-600">{COPY.ceb.englishOnly}</p>
      )}

      {SECTIONS.map((key) =>
        (data[key] || []).length > 0 ? (
          <div key={key} className="mt-3">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
              {t[key]}
            </p>
            <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-gray-800">
              {data[key].map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}

      {(data.notes || []).map((note, i) => (
        <p key={i} className="mt-3 text-xs text-gray-700">
          {note}
        </p>
      ))}

      {sources.length > 0 && (
        <p className="mt-3 text-xs text-gray-600">
          {t.source}:{" "}
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && "; "}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-700 underline"
              >
                {s.title}
              </a>
            </span>
          ))}
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500">{t.footer}</p>
    </div>
  );
}
