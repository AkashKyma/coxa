import { useState, useCallback } from "react";
import "./fan-engagement-pages.css";

const FAKE_PIX_KEY = "coxa-club@pix.com.br";

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const MOCK_POSTS = [
  {
    id: "p1",
    author: "Rodrigo Moraes",
    time: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    text: "What a goal by Coutinho yesterday! My jersey is already washed for Friday. Let's go Coxa! 🟢",
    likes: 38,
    comments: 7,
    liked: false,
  },
  {
    id: "p2",
    author: "Ana Clara Santos",
    time: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(),
    text: "Who else will be in the stands on Sunday? Message me and we can meet at gate 4 before the match! 🏟️🔥",
    likes: 54,
    comments: 21,
    liked: false,
  },
  {
    id: "p3",
    author: "Felipe Drummond",
    time: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    text: "I just renewed my Sócio Coxa plan for another year. Best investment of the month, no doubt. The club is growing so much this year! 💚",
    likes: 72,
    comments: 14,
    liked: false,
  },
  {
    id: "p4",
    author: "Marina Teixeira",
    time: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    text: "Does anyone have a spare ticket for Wednesday's match? I missed the purchase deadline and really want to go 😭 Message me!",
    likes: 11,
    comments: 33,
    liked: false,
  },
  {
    id: "p5",
    author: "Thiago Cavalcante",
    time: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    text: "Photo from today's training 👇 The team is sharp, I'm so proud of this squad. Coxa is going far this season! Together we go! 🟢⚽",
    likes: 129,
    comments: 42,
    liked: false,
  },
  {
    id: "p6",
    author: "Juliana Fonseca",
    time: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
    text: "I visited the club museum today and almost cried seeing the trophies. What a rich history this club has. I'm so proud to have been a fan since I was 8. Green and white in my heart. 💚🤍",
    likes: 201,
    comments: 58,
    liked: false,
  },
];

const TABS = ["For you", "Following", "Top of the Week"];

function PostCard({ post, onLike }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = post.text.length > 140;

  return (
    <article className="comm-card">
      <div className="comm-card__top">
        <div className="comm-avatar">{initials(post.author)}</div>
        <div className="comm-card__meta">
          <p className="comm-card__name">{post.author}</p>
          <span className="comm-card__time">{relativeTime(post.time)}</span>
        </div>
      </div>

      <p className={`comm-card__body${isLong && !expanded ? " comm-card__body--clamped" : ""}`}>
        {post.text}
      </p>
      {isLong && (
        <button className="comm-see-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "See less" : "See more"}
        </button>
      )}

      <div className="comm-reactions">
        <button
          className={`comm-reaction-btn${post.liked ? " comm-reaction-btn--active" : ""}`}
          onClick={() => onLike(post.id)}
          aria-pressed={post.liked}
        >
          ❤️ Like {post.likes}
        </button>
        <button className="comm-reaction-btn">💬 Comment {post.comments}</button>
        <button className="comm-reaction-btn">🔁 Share</button>
      </div>
    </article>
  );
}

function ComposeSheet({ onClose, onPublish }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const max = 280;

  async function handlePublish() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      const token = localStorage.getItem("coxa_fan_token");
      await fetch(`${API_URL}/api/v1/cdp/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": import.meta.env.VITE_TENANT_ID ?? "coxa-club-001",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          eventName: "community_post_created",
          properties: { text: text.trim() },
          source: "fan_app",
        }),
      }).catch(() => {});
    } finally {
      onPublish(text.trim());
      setLoading(false);
    }
  }

  return (
    <div className="eng-sheet-overlay" onClick={onClose}>
      <div className="eng-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="eng-sheet__handle" />
        <h2>New post</h2>
        <textarea
          className="comm-textarea"
          placeholder="What do you want to share with the fans?"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, max))}
          autoFocus
        />
        <p className="comm-char-counter">
          {text.length}/{max}
        </p>
        <button
          className="comm-publish-btn"
          onClick={handlePublish}
          disabled={!text.trim() || loading}
        >
          {loading ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [composing, setComposing] = useState(false);

  const handleLike = useCallback((id) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    );
    const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
    const token = localStorage.getItem("coxa_fan_token");
    fetch(`${API_URL}/api/v1/cdp/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": import.meta.env.VITE_TENANT_ID ?? "coxa-club-001",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ eventName: "community_post_liked", properties: { postId: id }, source: "fan_app" }),
    }).catch(() => {});
  }, []);

  function handlePublish(text) {
    const newPost = {
      id: `opt-${Date.now()}`,
      author: "You",
      time: new Date().toISOString(),
      text,
      likes: 0,
      comments: 0,
      liked: false,
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposing(false);
  }

  const showEmpty = activeTab === 1;
  const displayPosts = activeTab === 2 ? [...posts].sort((a, b) => b.likes - a.likes) : posts;

  return (
    <div className="eng-page">
      <header className="eng-header">
        <h1>Community</h1>
        <button
          className="eng-btn-icon"
          onClick={() => setComposing(true)}
          aria-label="Create post"
          title="Create post"
        >
          ✏️
        </button>
      </header>

      <div className="comm-tabs" role="tablist">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === i}
            className={`comm-tab${activeTab === i ? " comm-tab--active" : ""}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {showEmpty ? (
        <div className="eng-empty-state">
          <p style={{ fontSize: "2rem" }}>🤝</p>
          <p>
            Follow other fans to see their content here. Find fans in the{" "}
            <strong>"For you"</strong> tab.
          </p>
        </div>
      ) : (
        <div className="comm-feed">
          {displayPosts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} />
          ))}
        </div>
      )}

      {composing && (
        <ComposeSheet onClose={() => setComposing(false)} onPublish={handlePublish} />
      )}
    </div>
  );
}
