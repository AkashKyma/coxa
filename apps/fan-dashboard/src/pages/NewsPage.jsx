import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./fan-content-pages.css";

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CATEGORIES = ["All", "Club", "Matches", "Transfers", "Behind the Scenes"];
const CAT_KEY = { Club: "clube", Matches: "jogo", Transfers: "transf", "Behind the Scenes": "basti" };

const MOCK_NEWS = [
  { id: "n1", title: "Coritiba announces contract renewal with striker Kayke for two more years",          category: "Club",              publishedAt: new Date(Date.now() - 2 * 3600000).toISOString(),  icon: "📰" },
  { id: "n2", title: "Coxa beats Athletico in the derby and takes the lead in Paranaense",               category: "Matches",           publishedAt: new Date(Date.now() - 5 * 3600000).toISOString(),  icon: "⚽" },
  { id: "n3", title: "Argentine midfielder Rodrigues is Coritiba's new signing for the second phase",    category: "Transfers",         publishedAt: new Date(Date.now() - 10 * 3600000).toISOString(), icon: "🔄" },
  { id: "n4", title: "Behind the scenes: watch Coxa's intense training before the decisive match",       category: "Behind the Scenes", publishedAt: new Date(Date.now() - 18 * 3600000).toISOString(), icon: "🎥" },
  { id: "n5", title: "Fans pack Couto Pereira and fire up the team in an impressive victory",            category: "Club",              publishedAt: new Date(Date.now() - 24 * 3600000).toISOString(), icon: "🏟️" },
  { id: "n6", title: "Coach Pintado speaks about strategy for Wednesday's clash",                        category: "Matches",           publishedAt: new Date(Date.now() - 30 * 3600000).toISOString(), icon: "🎙️" },
  { id: "n7", title: "Right-back Matheus Lima undergoes surgery and will miss Coxa for 30 days",        category: "Club",              publishedAt: new Date(Date.now() - 36 * 3600000).toISOString(), icon: "🏥" },
  { id: "n8", title: "Behind the dressing room: celebrating the Paranaense title",                      category: "Behind the Scenes", publishedAt: new Date(Date.now() - 48 * 3600000).toISOString(), icon: "🎉" },
];

const LOREM = [
  "Coritiba Football Club continues to impress this season with high-level performances. The coaching staff has been working tirelessly to prepare the squad for the challenges ahead, and the results are clearly positive on the pitch. Fans pack Couto Pereira at every match and make a real difference.",
  "With a renewed squad full of quality, Coxa enters each game with a clear attacking plan and great pressing intensity. Coach Pintado has implemented a tactical system that balances defensive solidity with quick transitions, which has been key to the good results.",
  "The board has also been doing an excellent job managing the club, seeking new sponsors and investing in youth development. Coritiba's future is promising, and fans can be sure the club will keep working hard to bring joy and win more and more titles.",
];

function BadgeFromCat({ cat }) {
  const map = { Club: "clube", Matches: "jogo", Transfers: "transf", "Behind the Scenes": "basti" };
  const k = map[cat] ?? "clube";
  return <span className={`fc-cat-badge fc-cat-badge--${k}`}>{cat}</span>;
}

function NewsDetail({ item, onBack }) {
  document.title = `${item.title} — Coxa`;
  return (
    <div className="news-detail">
      <button className="news-detail__back" onClick={onBack}>← Back</button>
      <div className="news-detail__hero">
        <h1 className="news-detail__hero-title">{item.title}</h1>
      </div>
      <div className="news-detail__body">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <BadgeFromCat cat={item.category} />
          <span style={{ fontSize: "0.78rem", color: "#888" }}>{relativeTime(item.publishedAt)}</span>
        </div>
        {LOREM.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeCat, setActiveCat] = useState("All");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  document.title = "News — Coxa";

  const selectedItem = id ? MOCK_NEWS.find((n) => n.id === id) : null;

  const filtered = useMemo(() => {
    let items = MOCK_NEWS;
    if (activeCat !== "All") items = items.filter((n) => n.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((n) => n.title.toLowerCase().includes(q));
    }
    return items;
  }, [activeCat, search]);

  if (selectedItem) {
    return <NewsDetail item={selectedItem} onBack={() => navigate("/news")} />;
  }

  if (id) {
    return (
      <div className="news-detail">
        <button className="news-detail__back" onClick={() => navigate("/news")}>← Back</button>
        <div className="fc-empty"><div className="fc-empty__icon">📭</div><p>News article not found.</p></div>
      </div>
    );
  }

  const [featured, ...rest] = filtered;

  return (
    <div className="news-page">
      <header className="fc-header">
        <h1>News</h1>
        <button className="fc-icon-btn" onClick={() => setShowSearch((v) => !v)} aria-label="Search">🔍</button>
      </header>

      {showSearch && (
        <div className="news-search-bar">
          <span>🔍</span>
          <input autoFocus placeholder="Search news..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="fc-icon-btn" style={{ minWidth: 28, minHeight: 28, padding: "0.1rem" }} onClick={() => setSearch("")}>✕</button>}
        </div>
      )}

      <div className="fc-chips">
        {CATEGORIES.map((c) => (
          <button key={c} className={`fc-chip${activeCat === c ? " fc-chip--active" : ""}`} onClick={() => setActiveCat(c)}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="fc-empty"><div className="fc-empty__icon">🔍</div><p>No news articles found.</p></div>
      ) : (
        <>
          {featured && (
            <div className="news-featured" onClick={() => navigate(`/news/${featured.id}`)}>
              <div className="news-featured__cat"><BadgeFromCat cat={featured.category} /></div>
              <h2 className="news-featured__title">{featured.title}</h2>
              <span className="news-featured__time">{relativeTime(featured.publishedAt)}</span>
            </div>
          )}

          <div className="news-list">
            {rest.map((item) => (
              <div key={item.id} className="news-item" onClick={() => navigate(`/news/${item.id}`)}>
                <div className="news-item__thumb">{item.icon}</div>
                <div className="news-item__body">
                  <p className="news-item__title">{item.title}</p>
                  <div className="news-item__meta">
                    <BadgeFromCat cat={item.category} />
                    <span className="news-item__time">{relativeTime(item.publishedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="news-load-more">Loading more...</div>
        </>
      )}
    </div>
  );
}
