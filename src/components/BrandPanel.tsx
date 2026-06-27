import { servedImageUrl, type ExtractedImage, type Job } from "../../shared/types.ts";
import { uiText } from "../i18n.ts";

/** Renders a value, or an explicit "Not found" marker when it's missing/empty. */
function Value({
  children,
  notFound,
}: {
  children: string | null | undefined;
  notFound: string;
}) {
  const v = (children ?? "").trim();
  return v ? <span>{v}</span> : <span className="not-found">{notFound}</span>;
}

/** Thumbnails that hide images which fail to load (e.g. hotlink-protected).
 *  Failures are reported up to the page so the notice shows once, at the top. */
function Thumbs({
  images,
  failedImages,
  onImageFail,
}: {
  images: ExtractedImage[];
  failedImages: Set<string>;
  onImageFail: (url: string) => void;
}) {
  const shown = images.slice(0, 8);
  const visibleCount = shown.filter((i) => !failedImages.has(i.url)).length;

  if (visibleCount === 0) return null;
  return (
    <div className="thumbs">
      {shown.map((img) => (
        <img
          key={img.url}
          src={servedImageUrl(img)}
          alt={img.alt ?? ""}
          loading="lazy"
          style={failedImages.has(img.url) ? { display: "none" } : undefined}
          onError={() => onImageFail(img.url)}
        />
      ))}
    </div>
  );
}

export function BrandPanel({
  job,
  failedImages,
  onImageFail,
}: {
  job: Job;
  failedImages: Set<string>;
  onImageFail: (url: string) => void;
}) {
  const t = uiText(job.language);
  const brief = job.brief;
  return (
    <aside className="brand-panel">
      <h2>{t.brand}</h2>

      <div className="brand-name">
        <Value notFound={t.notFound}>{brief?.name}</Value>
      </div>
      <div className="brand-tagline">
        <Value notFound={t.notFound}>{brief?.tagline}</Value>
      </div>

      <div className="field">
        <span className="label">{t.audience}</span>
        <Value notFound={t.notFound}>{brief?.audience}</Value>
      </div>

      <div className="field">
        <span className="label">{t.tone}</span>
        {brief && brief.tone.length ? (
          <div className="chips">
            {brief.tone.map((t) => (
              <span className="chip" key={t}>
                {t}
              </span>
            ))}
          </div>
        ) : (
          <span className="not-found">{t.notFound}</span>
        )}
      </div>

      <div className="field">
        <span className="label">{t.valueProps}</span>
        {brief && brief.valueProps.length ? (
          <ul className="props">
            {brief.valueProps.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        ) : (
          <span className="not-found">{t.notFound}</span>
        )}
      </div>

      <div className="field">
        <span className="label">{t.brandColors}</span>
        {job.colors.length ? (
          <div className="swatches">
            {job.colors.map((c) => (
              <div className="swatch" key={c} title={c}>
                <span style={{ background: c }} />
                <code>{c}</code>
              </div>
            ))}
          </div>
        ) : (
          <span className="not-found">{t.notFound}</span>
        )}
      </div>

      <div className="field">
        <span className="label">
          {t.images} ({job.images.length})
        </span>
        {job.images.length ? (
          <Thumbs images={job.images} failedImages={failedImages} onImageFail={onImageFail} />
        ) : (
          <span className="not-found">{t.notFound}</span>
        )}
      </div>
    </aside>
  );
}
