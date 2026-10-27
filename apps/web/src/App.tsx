import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PopularityMetric, PopularityResponse, ProviderCategory } from "@wachoo/shared";
import logo from "./assets/full-logo-dark-removebg-preview.png";
import heroBackground from "./hero-cinematic.jpg";

type CategoryResponse = {
  data: ProviderCategory[];
  total: number;
  page: number;
  hasMore: boolean;
};

type TitleSuggestion = {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  posterUrl: string | null;
  year: string | null;
  tmdbUrl: string;
};

const moods = [
  { label: "Make I Laugh", filter: "comedy", emoji: "😂" },
  { label: "Something Scary", filter: "scary", emoji: "😱" },
  { label: "Crime & Mystery", filter: "crime", emoji: "🕵️" },
  { label: "Love Stories", filter: "romance", emoji: "❤️" },
  { label: "Action", filter: "action", emoji: "⚔️" },
] as const;

function getSavedCategories(): Set<string> {
  try {
    const stored = window.localStorage.getItem("wachoo:saved-category-ids");
    const value: unknown = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function isEvidenceVerified(category: ProviderCategory): boolean {
  return (
    category.verificationStatus === "live_checked" &&
    category.sources.some(
      (source) =>
        source.sourceType === "provider" &&
        (source.evidenceType === "official_mention" ||
          source.evidenceType === "direct_provider_page"),
    )
  );
}

function scrollCategoryRail(direction: -1 | 1) {
  const rail = document.querySelector<HTMLElement>(".category-grid");
  const firstCard = rail?.firstElementChild as HTMLElement | null;
  if (!rail || !firstCard) return;
  const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
  rail.scrollBy({ left: direction * (firstCard.getBoundingClientRect().width + gap), behavior: "smooth" });
}

export default function App() {
  const [categories, setCategories] = useState<ProviderCategory[]>([]);
  const [totalCategories, setTotalCategories] = useState(0);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryHasMore, setCategoryHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, TitleSuggestion[]>>({});
  const [suggestionsConfigured, setSuggestionsConfigured] = useState(false);
  const [railHovered, setRailHovered] = useState(false);
  const [railFocused, setRailFocused] = useState(false);
  const [railPaused, setRailPaused] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(getSavedCategories);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [randomPickId, setRandomPickId] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [popularityMetric, setPopularityMetric] = useState<PopularityMetric>("copies");
  const [popularItems, setPopularItems] = useState<PopularityResponse["data"]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "100");
    if (query.trim()) params.set("q", query.trim());
    if (selectedMood) params.set("mood", selectedMood);

    const controller = new AbortController();
    const search = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/v1/categories?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("The category list could not be loaded.");
        const result = (await response.json()) as CategoryResponse;
        setCategories(result.data);
        setTotalCategories(result.total);
        setCategoryPage(result.page);
        setCategoryHasMore(result.hasMore);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The category list could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void search();
    return () => controller.abort();
  }, [query, selectedMood]);

  useEffect(() => {
    if (categories.length === 0) return;
    const controller = new AbortController();
    const loadSuggestions = async () => {
      try {
        const ids = categories
          .filter((category) => !Object.hasOwn(suggestions, category.id))
          .slice(0, 24)
          .map((category) => category.id);
        if (ids.length === 0) return;
        const response = await fetch(`/api/v1/categories/suggestions?ids=${encodeURIComponent(ids.join(","))}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json() as {
          configured: boolean;
          data: Record<string, TitleSuggestion[]>;
        };
        setSuggestions((previous) => ({ ...previous, ...result.data }));
        setSuggestionsConfigured(result.configured);
      } catch {
        // Poster matches are optional and must not block category browsing.
      }
    };
    void loadSuggestions();
    return () => controller.abort();
  }, [categories, suggestions]);

  useEffect(() => {
    if (railHovered || railFocused || railPaused || categories.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      const rail = categoryRailRef.current;
      const firstCard = rail?.firstElementChild as HTMLElement | null;
      if (!rail || rail.children.length < 2 || !firstCard) return;
      const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
      const step = firstCard.getBoundingClientRect().width + gap;
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - step / 2;
      rail.scrollTo({ left: atEnd ? 0 : rail.scrollLeft + step, behavior: "smooth" });
    }, 2400);
    return () => window.clearInterval(timer);
  }, [categories.length, railFocused, railHovered, railPaused]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPopularity = async () => {
      setPopularLoading(true);
      setPopularError("");
      try {
        const response = await fetch(`/api/v1/popular?metric=${popularityMetric}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Weekly popularity is temporarily unavailable.");
        const result = (await response.json()) as PopularityResponse;
        setPopularItems(result.data);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setPopularError(
          requestError instanceof Error
            ? requestError.message
            : "Weekly popularity is temporarily unavailable.",
        );
      } finally {
        if (!controller.signal.aborted) setPopularLoading(false);
      }
    };

    void loadPopularity();
    return () => controller.abort();
  }, [popularityMetric]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "wachoo:saved-category-ids",
        JSON.stringify([...favorites]),
      );
    } catch {
      // Saving still works for this page session when browser storage is unavailable.
    }
  }, [favorites]);

  useEffect(() => {
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    if (!("IntersectionObserver" in window)) {
      revealTargets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px 0px" },
    );

    revealTargets.forEach((target, index) => {
      target.style.setProperty("--reveal-delay", `${index * 90}ms`);
      observer.observe(target);
    });
    document.documentElement.classList.add("motion-ready");

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  const orderedCategories = useMemo(
    () =>
      [...categories].sort((first, second) =>
        Number(isEvidenceVerified(second)) - Number(isEvidenceVerified(first)),
      ),
    [categories],
  );

  const visibleCategories = useMemo(() => {
    let result = orderedCategories;
    if (randomPickId) result = result.filter((category) => category.id === randomPickId);
    if (favoritesOnly) result = result.filter((category) => favorites.has(category.id));
    return result;
  }, [favorites, favoritesOnly, orderedCategories, randomPickId]);

  async function trackPopularity(categoryId: string, metric: PopularityMetric) {
    try {
      const response = await fetch("/api/v1/popularity-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, metric }),
        keepalive: true,
      });
      if (!response.ok || metric !== popularityMetric) return;

      const popularityResponse = await fetch(`/api/v1/popular?metric=${metric}`);
      if (popularityResponse.ok) {
        const result = (await popularityResponse.json()) as PopularityResponse;
        setPopularItems(result.data);
      }
    } catch {
      // Popularity tracking must not interrupt copying or opening a category.
    }
  }

  async function copyText(value: string, label: string, categoryId?: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(`${label} copied.`);
      if (categoryId) trackPopularity(categoryId, "copies");
    } catch {
      setCopyFeedback("Copy was blocked by this browser. Please select and copy the text instead.");
    }
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const updated = new Set(current);
      if (updated.has(id)) updated.delete(id);
      else updated.add(id);
      return updated;
    });
  }

  async function loadMoreCategories() {
    if (loadingMore || !categoryHasMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(categoryPage + 1), pageSize: "100" });
      if (query.trim()) params.set("q", query.trim());
      if (selectedMood) params.set("mood", selectedMood);
      const response = await fetch(`/api/v1/categories?${params}`);
      if (!response.ok) throw new Error("More categories could not be loaded.");
      const result = (await response.json()) as CategoryResponse;
      setCategories((current) => [...current, ...result.data]);
      setCategoryPage(result.page);
      setCategoryHasMore(result.hasMore);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "More categories could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function surpriseMe() {
    setLoading(true);
    setError("");
    setCopyFeedback("");
    setRandomPickId("");
    setFavoritesOnly(false);

    try {
      const response = await fetch("/api/v1/categories");
      if (!response.ok) throw new Error("A surprise category could not be loaded.");
      const result = (await response.json()) as CategoryResponse;
      if (result.data.length === 0) {
        setError("There are no categories to pick from yet.");
        return;
      }

      const pick = result.data[Math.floor(Math.random() * result.data.length)];
      if (!pick) {
        setError("A surprise category could not be selected.");
        return;
      }
      setQuery("");
      setSelectedMood("");
      setRandomPickId(pick.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "A surprise category could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseMood(filter: string) {
    setRandomPickId("");
    setCopyFeedback("");
    setSelectedMood((current) => (current === filter ? "" : filter));
  }

  return (
    <main className="page-shell">
      <div
        className="home-stage"
        style={{
          "--hero-image": `url(${heroBackground})`,
          "--logo-sprite": `url(${logo})`,
        } as CSSProperties}
      >
        <header className="topbar">
          <a className="brand" href="/" aria-label="Wachoo home">
            <img src={logo} alt="Wachoo" />
          </a>
          <nav className="topbar-nav" aria-label="Main navigation">
            <a href="#discover">Discover</a>
            <a href="#categories">Categories</a>
          </nav>
        </header>

        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <h1 id="home-title">
              <span className="hero-word">Fi<span className="hero-orbit-point">n<span className="hero-infinity-mark hero-mark-find" aria-hidden="true" /></span>d</span>{" "}
              <span className="hero-word">y<span className="hero-orbit-point">o<span className="hero-infinity-mark hero-mark-your" aria-hidden="true" /></span>ur</span>{" "}
              <span className="hero-word">n<span className="hero-orbit-point">e<span className="hero-infinity-mark hero-mark-next" aria-hidden="true" /></span>xt</span>{" "}
              <span className="hero-word">wat<span className="hero-orbit-point">c<span className="hero-infinity-mark hero-mark-watch" aria-hidden="true" /></span>h.</span>
            </h1>
            <p className="home-hero-description">
              Find a category by mood, genre, or code, then open it on Netflix.
            </p>
            <a className="home-hero-cta" href="#discover">
              <span>Discover categories</span>
              <svg className="home-hero-cta-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3.5v16m-6.5-6.5L12 20l6.5-7" />
              </svg>
            </a>
          </div>
        </section>
      </div>

      {popularItems.length > 0 && !popularLoading && !popularError && (
        <section className="popular-section scroll-reveal" data-reveal aria-labelledby="popular-title">
          <div className="popular-heading">
            <div>
              <p className="popular-kicker">Wachoo community picks</p>
              <h2 id="popular-title">Popular this week</h2>
              <p className="popular-description">See which categories people are copying and opening on Netflix · last 7 days</p>
            </div>
            <div className="popular-toggle" role="group" aria-label="Popularity ranking">
              <button
                aria-pressed={popularityMetric === "copies"}
                onClick={() => setPopularityMetric("copies")}
                type="button"
              >Most copied</button>
              <button
                aria-pressed={popularityMetric === "opens"}
                onClick={() => setPopularityMetric("opens")}
                type="button"
              >Most opened</button>
            </div>
          </div>

          <div className="popular-grid" aria-live="polite">
            {popularItems.map(({ category, count }, index) => (
              <article className="popular-card" key={category.id}>
                <div className="popular-card-topline">
                  <span className="popular-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="popular-count">
                    {count} {popularityMetric === "copies"
                      ? count === 1 ? "copy" : "copies"
                      : count === 1 ? "open" : "opens"}
                  </span>
                </div>
                <h3>{category.name}</h3>
                <p className="popular-code">Code <code>{category.code}</code></p>
                <div className="popular-actions">
                  <button
                    onClick={() => void copyText(category.code, "Code", category.id)}
                    type="button"
                  >Copy code</button>
                  <a
                    href={category.providerUrl}
                    onClick={() => void trackPopularity(category.id, "opens")}
                    rel="noreferrer"
                    target="_blank"
                  >Open Netflix ↗</a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="discover" className="discover-intro scroll-reveal" data-reveal aria-labelledby="page-title">
        <h2 id="page-title">Wetin you wan watch today?</h2>
        <p className="hero-copy">Choose a mood. Discover something different.</p>
      </section>

      <section className="mood-section scroll-reveal" data-reveal aria-labelledby="moods-title">
        <h2 id="moods-title" className="visually-hidden">Choose a mood</h2>
        <div className="mood-grid">
          {moods.map((mood) => (
            <button
              aria-pressed={selectedMood === mood.filter}
              className="mood-card"
              key={mood.filter}
              onClick={() => chooseMood(mood.filter)}
              type="button"
            >
              <span className="mood-emoji" aria-hidden="true">{mood.emoji}</span>
              <span>{mood.label}</span>
            </button>
          ))}
          <button className="mood-card" onClick={() => void surpriseMe()} type="button">
            <span className="mood-emoji" aria-hidden="true">🎲</span>
            <span>Surprise Me</span>
          </button>
        </div>
      </section>

      <label className="search-box discover-search scroll-reveal" data-reveal>
        <span className="search-icon" aria-hidden="true">⌕</span>
        <span className="visually-hidden">Search genres, moods or codes</span>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setRandomPickId("");
            setCopyFeedback("");
            setQuery(event.target.value);
          }}
          placeholder="Search genres, moods or codes..."
        />
      </label>

      <section id="categories" className="directory scroll-reveal" data-reveal aria-labelledby="directory-title">
        <div className="result-tools">
          <div className="section-heading">
            <h2 id="directory-title">
              {randomPickId ? "Your surprise pick" : "Browse categories"}
            </h2>
            <span className="result-count" aria-live="polite">
              {favoritesOnly || randomPickId
                ? `${visibleCategories.length} ${visibleCategories.length === 1 ? "category" : "categories"}`
                : `${totalCategories.toLocaleString()} categories`}
            </span>
          </div>
          <label className="favourites-toggle">
            <input
              checked={favoritesOnly}
              onChange={(event) => {
                setRandomPickId("");
                setFavoritesOnly(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Favourites only ({favorites.size})</span>
          </label>
        </div>

        {randomPickId && !loading && (
          <p className="random-pick-note" role="status">Here’s a category picked for you.</p>
        )}

        {error ? (
          <p className="notice error" role="alert">{error}</p>
        ) : loading ? (
          <p className="notice" role="status">Loading categories…</p>
        ) : visibleCategories.length === 0 ? (
          <p className="notice">
            {favoritesOnly && favorites.size === 0
              ? "You have no favourites yet. Save a category to find it here."
              : "No matching categories in this collection yet."}
          </p>
        ) : (
          <div
            className="category-carousel"
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRailFocused(false);
            }}
            onFocusCapture={() => setRailFocused(true)}
            onMouseEnter={() => setRailHovered(true)}
            onMouseLeave={() => setRailHovered(false)}
            onPointerDown={() => setRailHovered(true)}
            onPointerUp={() => setRailHovered(false)}
          >
            <div className="category-rail-tools" role="group" aria-label="Category carousel controls">
              <span className="rail-hint">More categories · slide, swipe, or use the arrows</span>
              <div className="rail-buttons">
                <button
                  aria-label="Show previous categories"
                  className="rail-arrow"
                  onClick={() => scrollCategoryRail(-1)}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button
                  aria-label="Show next categories"
                  className="rail-arrow"
                  onClick={() => scrollCategoryRail(1)}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
                <button
                  aria-label={railPaused ? "Resume automatic slide" : "Pause automatic slide"}
                  aria-pressed={railPaused}
                  className="rail-pause"
                  onClick={() => setRailPaused((paused) => !paused)}
                  type="button"
                >{railPaused ? "Play" : "Pause"}</button>
              </div>
            </div>
            <div className="category-grid" ref={categoryRailRef} aria-label="Netflix categories">
            {visibleCategories.map((category) => {
              const isFavorite = favorites.has(category.id);
              const context = category.parentCategories[0]?.name ?? category.moods[0];
              const posterSuggestion = suggestions[category.id]?.[0];

              return (
                <article className="category-card" key={category.id}>
                  <div className={`category-poster${posterSuggestion?.posterUrl ? " has-poster" : ""}`}>
                    {posterSuggestion?.posterUrl ? (
                      <img
                        alt={`${posterSuggestion.title} poster, a genre match for ${category.name}`}
                        className="poster-image"
                        loading="lazy"
                        src={posterSuggestion.posterUrl}
                      />
                    ) : (
                      <div aria-hidden="true" className="poster-placeholder">
                        <span className="placeholder-glow" />
                        <span className="placeholder-frame" />
                        <span className="placeholder-caption">POSTER PREVIEW</span>
                      </div>
                    )}
                    <div aria-hidden="true" className="poster-shade" />
                    <div className="poster-copy">
                      <p className="poster-match">
                        {suggestionsConfigured && posterSuggestion
                          ? `TMDB pick · ${posterSuggestion.title}${posterSuggestion.year ? ` · ${posterSuggestion.year}` : ""}`
                          : context ?? "Wachoo category"}
                      </p>
                      <h3>{category.name}</h3>
                      <p className="poster-code">Code <code>{category.code}</code></p>
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        onClick={() => void copyText(category.code, "Code", category.id)}
                      >
                        <span aria-hidden="true">▢</span> Copy code
                      </button>
                      <a
                        href={category.providerUrl}
                        onClick={() => void trackPopularity(category.id, "opens")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Netflix <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                    <button
                      aria-label={`${isFavorite ? "Remove" : "Add"} ${category.name} ${isFavorite ? "from" : "to"} favourites`}
                      aria-pressed={isFavorite}
                      className="save-category"
                      onClick={() => toggleFavorite(category.id)}
                      type="button"
                    >
                      <span aria-hidden="true">{isFavorite ? "♥" : "♡"}</span>
                    </button>
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        )}
        {!loading && !randomPickId && categoryHasMore && (
          <div className="load-more-row">
            <span>Showing {categories.length.toLocaleString()} of {totalCategories.toLocaleString()}</span>
            <button disabled={loadingMore} onClick={() => void loadMoreCategories()} type="button">
              {loadingMore ? "Loading…" : "Load more categories"}
            </button>
          </div>
        )}
        <p className="copy-feedback" role="status" aria-live="polite">{copyFeedback}</p>
      </section>

      <footer className="footer">
        <span>Wachoo helps you find it. Netflix provides the viewing experience.</span>
        <span>Find it. Watch it. Love it.</span>
        <p className="tmdb-credit">
          Poster suggestions use TMDB genre matches and may not show titles in the exact Netflix category. This product uses the TMDB API but is not endorsed or certified by TMDB. <a href="https://www.themoviedb.org/" rel="noreferrer" target="_blank">The Movie Database (TMDB)</a>
        </p>
      </footer>
    </main>
  );
}
