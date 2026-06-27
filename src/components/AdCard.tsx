import { useEffect, useRef, useState } from "react";
import {
  servedImageUrl,
  type Ad,
  type ExtractedImage,
  type JobResponse,
} from "../../shared/types.ts";
import { ApiError, regenerateAd, updateAd } from "../api.ts";
import { uiText } from "../i18n.ts";

const MAX_UPLOAD_BYTES = 1_500_000;

interface Props {
  ad: Ad;
  /** All images found for the job — choices for "replace image". */
  imagePool: ExtractedImage[];
  language: string;
  onAdSaved: (ad: Ad) => void;
  onJobUpdated: (job: JobResponse) => void;
}

/** Reads a file into a self-contained data: URL (stored in D1 on save). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function AdCard({ ad, imagePool, language, onAdSaved, onJobUpdated }: Props) {
  const t = uiText(language);
  const poolUrls = imagePool.map(servedImageUrl);
  const fallbackImageUrl = poolUrls[0] ?? null;
  const initialImageUrl = ad.imageUrl ?? fallbackImageUrl;
  const [concept, setConcept] = useState(ad.creativeConcept);
  const [primary, setPrimary] = useState(ad.primaryText);
  const [headline, setHeadline] = useState(ad.headline);
  const [description, setDescription] = useState(ad.description);
  const [cta, setCta] = useState(ad.cta);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);

  const [busy, setBusy] = useState<null | "save" | "regen" | "upload">(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Track images that failed to load so we don't cycle back to them.
  const failedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setConcept(ad.creativeConcept);
    setPrimary(ad.primaryText);
    setHeadline(ad.headline);
    setDescription(ad.description);
    setCta(ad.cta);
    setImageUrl(ad.imageUrl ?? fallbackImageUrl);
    setError(null);
    setPickerOpen(false);
    failedRef.current = new Set();
  }, [ad.id, ad.version, fallbackImageUrl]);

  // If the chosen image can't be displayed (e.g. hotlink-protected source),
  // fall through to the next image that does load; placeholder if none do.
  function onImageError() {
    if (imageUrl) failedRef.current.add(imageUrl);
    const next = poolUrls.find((u) => !failedRef.current.has(u));
    setImageUrl(next ?? null);
  }

  const dirty =
    concept !== ad.creativeConcept ||
    primary !== ad.primaryText ||
    headline !== ad.headline ||
    description !== ad.description ||
    cta !== ad.cta ||
    imageUrl !== initialImageUrl;

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const { ad: saved } = await updateAd({
        id: ad.id,
        version: ad.version,
        creativeConcept: concept,
        primaryText: primary,
        headline,
        description,
        cta,
        imageUrl,
      });
      onAdSaved(saved);
    } catch (e) {
      setError(errText(e, language));
    } finally {
      setBusy(null);
    }
  }

  async function regen() {
    setBusy("regen");
    setError(null);
    try {
      onJobUpdated(await regenerateAd(ad.id, ad.version));
    } catch (e) {
      setError(errText(e, language));
    } finally {
      setBusy(null);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t.chooseImageFile);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t.imageTooLarge);
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      setImageUrl(dataUrl);
      setPickerOpen(false);
    } catch (err) {
      setError(errText(err, language));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ad-card">
      <div className="ad-head">
        <span className="ad-version">v{ad.version}</span>
        {ad.edited && <span className="badge edited">edited</span>}
      </div>

      <div className="ad-media">
        {imageUrl ? (
          <img
            className="ad-image"
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={onImageError}
          />
        ) : (
          <div className="ad-image placeholder">{t.noImage}</div>
        )}
        <div className="ad-media-actions">
          <button type="button" className="link" onClick={() => setPickerOpen((v) => !v)}>
            {t.replace}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "upload"}
          >
            {busy === "upload" ? t.uploading : t.upload}
          </button>
          {imageUrl && poolUrls.length === 0 && (
            <button type="button" className="link" onClick={() => setImageUrl(null)}>
              {t.remove}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickFile}
          />
        </div>
        {pickerOpen && (
          <div className="img-picker">
            {imagePool.length === 0 && <span className="not-found">{t.noImagesFound}</span>}
            {imagePool.map((img) => {
              const u = servedImageUrl(img);
              return (
                <img
                  key={img.url}
                  src={u}
                  alt={img.alt ?? ""}
                  loading="lazy"
                  className={u === imageUrl ? "selected" : ""}
                  onClick={() => {
                    setImageUrl(u);
                    setPickerOpen(false);
                  }}
                  onError={(ev) => (ev.currentTarget.style.display = "none")}
                />
              );
            })}
          </div>
        )}
      </div>

      <label className="ad-field">
        <span>{t.creativeConcept}</span>
        <input value={concept} maxLength={300} onChange={(e) => setConcept(e.target.value)} />
      </label>
      <label className="ad-field">
        <span>{t.primaryText}</span>
        <textarea value={primary} maxLength={1200} rows={3} onChange={(e) => setPrimary(e.target.value)} />
      </label>
      <label className="ad-field">
        <span>{t.headline}</span>
        <input value={headline} maxLength={200} onChange={(e) => setHeadline(e.target.value)} />
      </label>
      <label className="ad-field">
        <span>{t.description}</span>
        <input value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="ad-field">
        <span>{t.cta}</span>
        <input value={cta} maxLength={80} onChange={(e) => setCta(e.target.value)} />
      </label>

      {error && <div className="ad-error">{error}</div>}

      <div className="ad-actions">
        <button onClick={save} disabled={!dirty || busy !== null}>
          {busy === "save" ? t.saving : t.save}
        </button>
        <button className="secondary" onClick={regen} disabled={busy !== null}>
          {busy === "regen" ? t.regenerating : t.regenerate}
        </button>
      </div>
    </div>
  );
}

function errText(e: unknown, language = "auto"): string {
  const t = uiText(language);
  if (e instanceof ApiError) {
    if (e.status === 409) return e.message + t.reloadLatest;
    return e.message;
  }
  return e instanceof Error ? e.message : t.unexpectedError;
}
