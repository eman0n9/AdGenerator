import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { LANGUAGES, type Ad, type JobResponse } from "../../shared/types.ts";
import { ApiError, createJob } from "../api.ts";
import { uiText } from "../i18n.ts";
import { BrandPanel } from "../components/BrandPanel.tsx";
import { AdCard } from "../components/AdCard.tsx";

export const Route = createFileRoute("/")({
  component: Home,
});

const EXAMPLES = [
  { label: "stripe.com", url: "https://stripe.com" },
  { label: "notion.so", url: "https://www.notion.so" },
  { label: "linear.app", url: "https://linear.app" },
];

function Home() {
  const [url, setUrl] = useState("");
  const [count, setCount] = useState(3);
  const [language, setLanguage] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);

  async function run(targetUrl: string) {
    const clean = targetUrl.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      setJob(await createJob(clean, count, language));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server — the request was interrupted. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(url);
  }

  function replaceAd(saved: Ad) {
    setJob((prev) =>
      prev ? { ...prev, ads: prev.ads.map((a) => (a.id === saved.id ? saved : a)) } : prev,
    );
  }

  return (
    <div className="page">
      <div className="glow glow-a" />
      <div className="glow glow-b" />

      <nav className="nav">
        <div className="brand">
          <span className="brand-mark" />
          Ad&nbsp;Generator
        </div>
      </nav>

      <main className="app">
        {!job && (
          <section className="hero">
            <div className="eyebrow">AI Ad Generator</div>
            <h1 className="hero-title">
              Drop a brand's URL:
              <br />
              AI writes the ads instantly.
            </h1>

            <form className="prompt" onSubmit={onSubmit}>
              <input
                className="prompt-input"
                type="url"
                required
                placeholder="Paste a website URL — e.g. https://stripe.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <div className="prompt-footer">
                <div className="controls">
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} ad{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="round" type="submit" disabled={loading} aria-label="Create">
                  {loading ? <span className="spin" /> : "↑"}
                </button>
              </div>
            </form>

            <div className="suggests">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.url}
                  className="suggest"
                  onClick={() => {
                    setUrl(ex.url);
                    void run(ex.url);
                  }}
                >
                  {ex.label} <span className="arrow">↑</span>
                </button>
              ))}
            </div>

            <p className="tagline">
              Brand-aware ads grounded in the real site — tone-matched, no hallucinations.
            </p>
          </section>
        )}

        <div className={job ? "results" : "centered"}>
          {job && (
            <form className="searchbar" onSubmit={onSubmit}>
              <input
                className="searchbar-input"
                type="url"
                required
                placeholder="Try another URL…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <div className="searchbar-row">
                <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} ad{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={loading}>
                  {loading ? "Working…" : "Create"}
                </button>
              </div>
            </form>
          )}

          {loading && (
            <div className="hint">Fetching, analyzing and writing — up to ~30s…</div>
          )}
          {error && <div className="banner error">{error}</div>}

          {job && <JobView job={job} onReplaceAd={replaceAd} onReplaceJob={setJob} />}
        </div>
      </main>
    </div>
  );
}

function JobView({
  job,
  onReplaceAd,
  onReplaceJob,
}: {
  job: JobResponse;
  onReplaceAd: (ad: Ad) => void;
  onReplaceJob: (j: JobResponse) => void;
}) {
  const j = job.job;
  const imagePool = j.images;
  const t = uiText(j.language);

  const [imgFailed, setImgFailed] = useState<Set<string>>(new Set());
  useEffect(() => setImgFailed(new Set()), [j.id]);

  return (
    <>
      <section className="status-bar">
        <span className={`badge status-${j.status}`}>{j.status}</span>
        <span className="meta">
          render: <b>{j.renderMode}</b>
        </span>
        <span className="meta">
          cost: <b>${j.costUsd.toFixed(4)}</b>
        </span>
        <span className="meta">
          tokens: <b>{j.tokensIn + j.tokensOut}</b>
        </span>
        <span className="meta">
          time: <b>{(j.durationMs / 1000).toFixed(1)}s</b>
        </span>
      </section>

      {j.degradationReasons.length > 0 && (
        <div className="banner warn">
          <strong>
            {j.status === "failed"
              ? "Couldn't process this URL — why:"
              : "Result is partial — why:"}
          </strong>
          <ul>
            {j.degradationReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {imgFailed.size > 0 && (
        <div className="banner warn">{t.imageDisplayFailed(imgFailed.size)}</div>
      )}

      <div className="layout">
        <BrandPanel
          job={j}
          failedImages={imgFailed}
          onImageFail={(url) => setImgFailed((s) => new Set(s).add(url))}
        />
        <main className="ads">
          {job.ads.length === 0 ? (
            <div className="empty">
              <strong className="not-found">No ads — not found.</strong>
              <div>The brand brief or page content wasn't sufficient. See the reasons above.</div>
            </div>
          ) : (
            <div className="ads-grid">
              {job.ads.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  imagePool={imagePool}
                  language={j.language}
                  onAdSaved={onReplaceAd}
                  onJobUpdated={onReplaceJob}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
