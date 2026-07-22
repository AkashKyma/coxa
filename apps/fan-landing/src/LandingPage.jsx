import { useState, useEffect } from "react";
import "./landing.css";
import { analytics } from "@coxa/analytics";

const FAN_AUTH_URL = import.meta.env.VITE_FAN_AUTH_URL ?? "http://localhost:5175";

const BG_IMAGES = [
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&w=1920&q=85&fit=crop&crop=center",
  "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&w=1920&q=80&fit=crop",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&w=1920&q=80&fit=crop",
];

function StadiumBg() {
  const [idx, setIdx] = useState(0);

  function handleError() {
    setIdx((i) => i + 1);
  }

  if (idx >= BG_IMAGES.length) return null;

  return (
    <div className="landing__bg">
      <img
        key={idx}
        src={BG_IMAGES[idx]}
        alt=""
        aria-hidden="true"
        onError={handleError}
        fetchPriority="high"
      />
    </div>
  );
}

export default function LandingPage() {
  // Fire a page view on mount
  useEffect(() => {
    analytics.page("Landing", { path: "/", app: "fan-landing" });
  }, []);

  return (
    <div className="landing">
      <StadiumBg />

      <div className="landing__overlay" aria-hidden="true" />

      <div className="content">
        <div className="crest" aria-hidden="true">C</div>

        <h1 className="brand-name">
          COXA <span className="id">iD</span>
        </h1>

        <p className="subtitle">Sua conta única de relacionamento com o clube</p>

        <div className="actions">
          <a
            href={`${FAN_AUTH_URL}/signup`}
            className="btn-main"
            onClick={() => analytics.track("landing_cta_clicked", { cta: "create_account", app: "fan-landing" })}
          >
            Criar meu Coxa iD
          </a>
          <a
            href={`${FAN_AUTH_URL}/`}
            className="btn-ghost"
            onClick={() => analytics.track("landing_cta_clicked", { cta: "sign_in", app: "fan-landing" })}
          >
            Já tenho conta — entrar
          </a>
        </div>
      </div>

      <p className="caption">Coritiba Foot Ball Club · {new Date().getFullYear()}</p>
    </div>
  );
}
