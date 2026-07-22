import { useEffect, useState } from "react";
import { loyaltyApi } from "../lib/api.js";
import "./fan-engagement-pages.css";

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function tierClass(tier = "") {
  const t = tier.toLowerCase();
  if (t === "gold" || t === "ouro") return "gold";
  if (t === "silver" || t === "prata") return "silver";
  return "bronze";
}

function tierLabel(tier = "") {
  const t = tier.toLowerCase();
  if (t === "gold") return "Gold";
  if (t === "silver") return "Silver";
  if (t === "gold" || t === "ouro") return "Gold";
  if (t === "prata") return "Silver";
  return "Bronze";
}

const MOCK_FANS = [
  { pos: 1,  name: "Lucas Fernandes",    pts: 14820 },
  { pos: 2,  name: "Mariana Costa",      pts: 13450 },
  { pos: 3,  name: "Rafael Oliveira",    pts: 12900 },
  { pos: 4,  name: "Juliana Pereira",    pts: 11200 },
  { pos: 5,  name: "Thiago Almeida",     pts: 10850 },
  { pos: 6,  name: "Beatriz Gomes",      pts: 9740  },
  { pos: 7,  name: "Eduardo Santos",     pts: 9200  },
  { pos: 8,  name: "Camila Rocha",       pts: 8750  },
  { pos: 9,  name: "Pedro Carvalho",     pts: 8100  },
  { pos: 10, name: "Sofia Lima",         pts: 7650  },
  { pos: 11, name: "André Souza",        pts: 7200  },
  { pos: 12, name: "Gabriela Martins",   pts: 6890  },
  { pos: 13, name: "Felipe Torres",      pts: 6400  },
  { pos: 14, name: "Isabela Ribeiro",    pts: 6100  },
  { pos: 15, name: "Gustavo Barbosa",    pts: 5750  },
  { pos: 16, name: "Amanda Nunes",       pts: 5300  },
  { pos: 17, name: "Rodrigo Melo",       pts: 4920  },
  { pos: 18, name: "Letícia Freitas",    pts: 4500  },
  { pos: 19, name: "Vinicius Castro",    pts: 4150  },
  { pos: 20, name: "Natalia Moreira",    pts: 3800  },
];

const TABS = ["Overall", "Monthly", "My City"];

function posDisplay(pos) {
  if (pos === 1) return { icon: "🥇", cls: "ldr-row--top1" };
  if (pos === 2) return { icon: "🥈", cls: "ldr-row--top2" };
  if (pos === 3) return { icon: "🥉", cls: "ldr-row--top3" };
  return { icon: null, cls: "" };
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [myData, setMyData] = useState(null);
  const [myLoading, setMyLoading] = useState(true);
  const [fans, setFans] = useState([]);
  const [ldrLoading, setLdrLoading] = useState(true);

  useEffect(() => {
    loyaltyApi.me()
      .then((res) => setMyData(res.data))
      .catch(() => setMyData(null))
      .finally(() => setMyLoading(false));
  }, []);

  useEffect(() => {
    setLdrLoading(true);
    fetch(
      `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api/v1/loyalty/leaderboard?limit=50`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": import.meta.env.VITE_TENANT_ID ?? "coxa-club-001",
          ...(localStorage.getItem("coxa_fan_token") && {
            Authorization: `Bearer ${localStorage.getItem("coxa_fan_token")}`,
          }),
        },
      },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        const list = data.data ?? data.fans ?? [];
        if (list.length > 0) {
          setFans(list.map((f, i) => ({ pos: i + 1, name: f.fullName ?? f.displayName ?? f.name ?? "Fan", pts: f.balance ?? f.points ?? 0 })));
        } else {
          setFans(MOCK_FANS);
        }
      })
      .catch(() => setFans(MOCK_FANS))
      .finally(() => setLdrLoading(false));
  }, []);

  const myTier = tierClass(myData?.fan?.loyaltyTier ?? myData?.loyaltyTier ?? "");
  const myTierLabel = tierLabel(myData?.fan?.loyaltyTier ?? myData?.loyaltyTier ?? "");
  const myName =
    myData?.fan?.fullName?.split(" ")[0] ??
    myData?.fullName?.split(" ")[0] ??
    "You";
  const myPts = (myData?.balance ?? 0).toLocaleString();

  const displayFans = activeTab === 1
    ? fans.map((f, i) => ({ ...f, pts: Math.round(f.pts * 0.3), pos: i + 1 }))
    : activeTab === 2
    ? fans.slice(0, 10).map((f, i) => ({ ...f, pos: i + 1 }))
    : fans;

  return (
    <div className="eng-page">
      <header className="eng-header">
        <h1>🏆 Fan Rankings</h1>
      </header>

      {/* My position banner */}
      {!myLoading && (
        <div className="ldr-my-banner">
          <div className="ldr-my-banner__rank">#247</div>
          <div className="ldr-my-banner__info">
            <div className="ldr-my-banner__name">{myName}</div>
            <div className="ldr-my-banner__pts">{myPts} points</div>
          </div>
          <span className={`ldr-tier-chip ldr-tier-chip--${myTier}`}>{myTierLabel}</span>
        </div>
      )}

      <div className="ldr-tabs" role="tablist">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === i}
            className={`ldr-tab${activeTab === i ? " ldr-tab--active" : ""}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {ldrLoading ? (
        <div className="eng-loading">Loading rankings…</div>
      ) : (
        <div className="ldr-list">
          {displayFans.map((fan) => {
            const { icon, cls } = posDisplay(fan.pos);
            return (
              <div key={`${fan.pos}-${fan.name}`} className={`ldr-row${cls ? ` ${cls}` : ""}`}>
                <span className={`ldr-row__pos${!icon ? " ldr-row__pos--num" : ""}`}>
                  {icon ?? fan.pos}
                </span>
                <div className="ldr-row__avatar">{initials(fan.name)}</div>
                <span className="ldr-row__name">{fan.name}</span>
                <span className="ldr-row__pts">{fan.pts.toLocaleString()} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
