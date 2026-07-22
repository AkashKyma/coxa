import { useEffect, useState } from "react";
import { loyaltyApi } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import DataTable from "@coxa/ui/DataTable";

const ENTRY_LABELS = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjustment",
  reverse: "Reversed",
  expire: "Expired",
};

function entryClass(type) {
  if (type === "earn" || type === "adjust") return "event-status--sale";
  if (type === "redeem" || type === "reverse" || type === "expire") return "event-status--cancelled";
  return "event-status--draft";
}

export default function RewardsPage() {
  const { fanProfile } = useAuth();
  const [loyalty, setLoyalty] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [redeeming, setRedeeming] = useState(null);

  function load() {
    loyaltyApi
      .me()
      .then((res) => setLoyalty(res.data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRedeem(reward) {
    if ((loyalty?.balance ?? 0) < reward.pointsCost) {
      setError("Not enough points for this reward.");
      return;
    }
    setRedeeming(reward.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await loyaltyApi.redeemReward(reward.id);
      setSuccess(`Redeemed: ${res.data.reward.name}. New balance: ${res.data.entry.balanceAfter.toLocaleString()} pts`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRedeeming(null);
    }
  }

  const columns = [
    {
      key: "date",
      header: "Date",
      render: (entry) => new Date(entry.createdAt).toLocaleDateString(),
    },
    {
      key: "type",
      header: "Type",
      render: (entry) => (
        <span className={`status-pill ${entryClass(entry.entryType)}`}>
          {ENTRY_LABELS[entry.entryType] ?? entry.entryType}
        </span>
      ),
    },
    {
      key: "points",
      header: "Points",
      render: (entry) => (
        <strong style={{ color: entry.pointsDelta > 0 ? "var(--coxa-success)" : "inherit" }}>
          {entry.pointsDelta > 0 ? `+${entry.pointsDelta}` : entry.pointsDelta}
        </strong>
      ),
    },
    {
      key: "note",
      header: "Details",
      render: (entry) => entry.note ?? "—",
    },
    {
      key: "balance",
      header: "Balance",
      render: (entry) => entry.balanceAfter?.toLocaleString(),
    },
  ];

  const summary = loyalty?.summary;

  return (
    <div>
      <header className="page-header">
        <h1>Rewards</h1>
        <p>Points balance, earn rules, reward redemptions for {fanProfile?.email ?? "your account"}.</p>
      </header>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="cards">
        <article className="card">
          <h3>Available balance</h3>
          <p className="value">{(loyalty?.balance ?? 0).toLocaleString()} pts</p>
        </article>
        <article className="card">
          <h3>Lifetime earned</h3>
          <p className="value">{(summary?.lifetimeEarned ?? 0).toLocaleString()} pts</p>
        </article>
        <article className="card">
          <h3>Redeemed</h3>
          <p className="value">{(summary?.lifetimeRedeemed ?? 0).toLocaleString()} pts</p>
        </article>
      </div>

      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <h2 className="panel__title">How you earn</h2>
        {!loyalty?.earnRules?.length ? (
          <p className="panel__desc">Earn rules will appear here when configured by the club.</p>
        ) : (
          <ul className="earn-rules-list">
            {loyalty.earnRules.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.name}</strong>
                <span>{rule.earnLabel}</span>
                {rule.description && <p className="panel__desc">{rule.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <h2 className="panel__title">Redeem rewards</h2>
        {!loyalty?.rewards?.length ? (
          <p className="panel__desc">No rewards available right now — check back before matchday.</p>
        ) : (
          <div className="cards">
            {loyalty.rewards.map((reward) => {
              const canAfford = (loyalty?.balance ?? 0) >= reward.pointsCost;
              const remaining =
                reward.inventoryLimit != null
                  ? Math.max(0, reward.inventoryLimit - (reward.redeemedCount ?? 0))
                  : null;
              return (
                <article key={reward.id} className="card reward-card">
                  <span className="status-pill event-status--published">{reward.rewardType}</span>
                  <h3>{reward.name}</h3>
                  <p className="panel__desc">{reward.description}</p>
                  <p className="value">{reward.pointsCost.toLocaleString()} pts</p>
                  {remaining != null && (
                    <p className="panel__desc">{remaining} remaining</p>
                  )}
                  {reward.terms && <p className="panel__desc">{reward.terms}</p>}
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!canAfford || redeeming === reward.id || remaining === 0}
                    onClick={() => handleRedeem(reward)}
                  >
                    {redeeming === reward.id
                      ? "Redeeming…"
                      : !canAfford
                        ? "Not enough points"
                        : remaining === 0
                          ? "Sold out"
                          : "Redeem"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <h2 className="panel__title">Activity history</h2>
        {!loyalty?.ledger?.length ? (
          <p className="panel__desc">No activity yet. Shop, buy tickets or check in as a member to earn points.</p>
        ) : (
          <DataTable columns={columns} data={loyalty.ledger} pagination={loyalty.ledger.length > 10} />
        )}
      </section>
    </div>
  );
}
