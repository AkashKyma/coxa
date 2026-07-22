import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";

const RULE_ICONS = {
  earn_retail: "🛍",
  earn_fan_shop: "🌐",
  earn_ticket: "🎟",
  earn_attendance: "🏟",
};

const RULE_TYPES = [
  { value: "earn_retail", label: "Retail POS earn" },
  { value: "earn_fan_shop", label: "Fan shop earn" },
  { value: "earn_ticket", label: "Ticket purchase earn" },
  { value: "earn_attendance", label: "Member check-in earn" },
];

const REWARD_TYPES = [
  { value: "discount", label: "Discount" },
  { value: "merchandise", label: "Merchandise" },
  { value: "fnb", label: "Food & beverage" },
  { value: "experience", label: "Experience" },
  { value: "voucher", label: "Voucher" },
];

const EMPTY_RULE = {
  id: "",
  name: "",
  ruleType: "earn_retail",
  pointsPerReal: 1,
  minAmountCents: 0,
  status: "active",
  description: "",
};

const EMPTY_REWARD = {
  id: "",
  code: "",
  name: "",
  description: "",
  rewardType: "voucher",
  pointsCost: 500,
  status: "active",
  inventoryLimit: "",
  terms: "",
};

export default function LoyaltyRulesPage() {
  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState("adjust");
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [rewardForm, setRewardForm] = useState(EMPTY_REWARD);
  const [adjust, setAdjust] = useState({
    fanEmail: "fan@coxa.local",
    pointsDelta: 100,
    note: "",
  });
  const [saving, setSaving] = useState(false);

  function load() {
    Promise.all([api.listLoyaltyRules(), api.listLoyaltyRewards()])
      .then(([rulesRes, rewardsRes]) => {
        setRules(rulesRes.data);
        setRewards(rewardsRes.data);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function openRuleEdit(rule) {
    setSidebarMode("rule");
    setRuleForm({
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      pointsPerReal: rule.pointsPerReal,
      minAmountCents: rule.minAmountCents ?? 0,
      status: rule.status,
      description: rule.description ?? "",
    });
    setSidebarOpen(true);
  }

  function openRuleCreate() {
    setSidebarMode("rule");
    setRuleForm(EMPTY_RULE);
    setSidebarOpen(true);
  }

  function openRewardEdit(reward) {
    setSidebarMode("reward");
    setRewardForm({
      id: reward.id,
      code: reward.code,
      name: reward.name,
      description: reward.description ?? "",
      rewardType: reward.rewardType,
      pointsCost: reward.pointsCost,
      status: reward.status,
      inventoryLimit: reward.inventoryLimit ?? "",
      terms: reward.terms ?? "",
    });
    setSidebarOpen(true);
  }

  function openRewardCreate() {
    setSidebarMode("reward");
    setRewardForm(EMPTY_REWARD);
    setSidebarOpen(true);
  }

  async function saveRule(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.saveLoyaltyRule({
        ...(ruleForm.id ? { id: ruleForm.id } : {}),
        name: ruleForm.name,
        ruleType: ruleForm.ruleType,
        pointsPerReal: Number(ruleForm.pointsPerReal),
        minAmountCents: Number(ruleForm.minAmountCents) || 0,
        status: ruleForm.status,
        description: ruleForm.description || undefined,
      });
      setSuccess("Earn rule saved.");
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveReward(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.saveLoyaltyReward({
        ...(rewardForm.id ? { id: rewardForm.id } : {}),
        code: rewardForm.code.trim(),
        name: rewardForm.name.trim(),
        description: rewardForm.description || undefined,
        rewardType: rewardForm.rewardType,
        pointsCost: Number(rewardForm.pointsCost),
        status: rewardForm.status,
        inventoryLimit:
          rewardForm.inventoryLimit === "" ? null : Number(rewardForm.inventoryLimit),
        terms: rewardForm.terms || undefined,
      });
      setSuccess("Reward saved.");
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjust(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const search = await api.searchProfiles(adjust.fanEmail);
      const fanProfileId = search.data[0]?.id;
      if (!fanProfileId) throw new Error("Fan profile not found for that email");
      const res = await api.adjustPoints({
        fanProfileId,
        pointsDelta: Number(adjust.pointsDelta),
        note: adjust.note || "Manual adjustment",
      });
      setSuccess(`Adjustment applied — new balance: ${res.data.balanceAfter.toLocaleString()} pts`);
      setSidebarOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const rewardColumns = [
    { key: "code", header: "Code", render: (r) => <code>{r.code}</code> },
    { key: "name", header: "Reward", render: (r) => r.name },
    {
      key: "type",
      header: "Type",
      render: (r) => r.rewardType,
    },
    {
      key: "cost",
      header: "Cost",
      render: (r) => `${r.pointsCost.toLocaleString()} pts`,
    },
    {
      key: "inventory",
      header: "Inventory",
      render: (r) =>
        r.inventoryLimit != null
          ? `${r.redeemedCount ?? 0} / ${r.inventoryLimit}`
          : "Unlimited",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className={`status-pill event-status--${r.status === "active" ? "sale" : "draft"}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => openRewardEdit(r)}>
          Edit
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        module="Loyalty"
        title="Loyalty program"
        description="Immutable points ledger — earn rules, reward catalog, manual adjustments and automatic earn/reversal via events."
        actions={
          tab === "rules" ? (
            <button type="button" className="btn btn--primary" onClick={openRuleCreate}>
              Add earn rule
            </button>
          ) : tab === "rewards" ? (
            <button type="button" className="btn btn--primary" onClick={openRewardCreate}>
              Add reward
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setSidebarMode("adjust");
                setSidebarOpen(true);
              }}
            >
              Adjust points
            </button>
          )
        }
      />

      {error && <div className="alert error">{error}</div>}
      {success && (
        <div className="alert success">
          {success}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => setSuccess(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="loyalty-tabs">
        {[
          { id: "rules", label: "Earn rules" },
          { id: "rewards", label: "Rewards catalog" },
          { id: "adjust", label: "Adjustments" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`loyalty-tabs__btn${tab === t.id ? " loyalty-tabs__btn--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="panel-card">
          <div className="panel-card__head">
            <h3>Earn rules</h3>
            <p>Applied when sale.completed, ticket.purchased, member.checked_in and reversed on sale.returned</p>
          </div>
          <div className="panel-card__body">
            {rules.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">No rules configured</p>
              </div>
            ) : (
              <div className="rule-list">
                {rules.map((rule) => (
                  <div key={rule.id} className="rule-card">
                    <div className="rule-card__icon">{RULE_ICONS[rule.ruleType] ?? "★"}</div>
                    <div className="rule-card__body">
                      <h4>{rule.name}</h4>
                      <div className="rule-card__rate">
                        {rule.ruleType === "earn_attendance"
                          ? `${rule.pointsPerReal} pts per check-in`
                          : `${rule.pointsPerReal} pt${rule.pointsPerReal !== 1 ? "s" : ""} per R$1`}
                      </div>
                      <p>{rule.description}</p>
                    </div>
                    <div className="rule-card__actions">
                      <span className="rule-card__type">{rule.ruleType.replace(/_/g, " ")}</span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => openRuleEdit(rule)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "rewards" && (
        <div className="panel-card">
          <div className="panel-card__head">
            <h3>Rewards catalog</h3>
            <p>Fans redeem rewards from the Fan Dashboard — points deducted via immutable ledger</p>
          </div>
          <div className="panel-card__body">
            <DataTable
              columns={rewardColumns}
              data={rewards}
              rowKey="id"
              emptyMessage="No rewards yet — add your first reward."
            />
          </div>
        </div>
      )}

      {tab === "adjust" && (
        <div className="panel-card">
          <div className="panel-card__head">
            <h3>Manual adjustments</h3>
            <p>Credit or debit points with reason — fully audited in the ledger and CDP</p>
          </div>
          <div className="panel-card__body">
            <p className="field-hint">
              Use for corrections, matchday bonuses, or support cases. Large adjustments should follow
              your approval policy.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: "1rem" }}
              onClick={() => {
                setSidebarMode("adjust");
                setSidebarOpen(true);
              }}
            >
              New adjustment
            </button>
          </div>
        </div>
      )}

      <FormSidebar
        open={sidebarOpen}
        title={
          sidebarMode === "rule"
            ? ruleForm.id
              ? "Edit earn rule"
              : "Add earn rule"
            : sidebarMode === "reward"
              ? rewardForm.id
                ? "Edit reward"
                : "Add reward"
              : "Manual adjustment"
        }
        onClose={() => setSidebarOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSidebarOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="loyalty-sidebar-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {sidebarMode === "rule" && (
          <form id="loyalty-sidebar-form" onSubmit={saveRule} className="form-grid">
            <div className="form-field form-field--full">
              <label className="field-label">Rule name</label>
              <input
                required
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
              />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Rule type</label>
              <select
                value={ruleForm.ruleType}
                onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value })}
                disabled={Boolean(ruleForm.id)}
              >
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">
                {ruleForm.ruleType === "earn_attendance" ? "Points per check-in" : "Points per R$1"}
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={ruleForm.pointsPerReal}
                onChange={(e) => setRuleForm({ ...ruleForm, pointsPerReal: e.target.value })}
              />
            </div>
            {ruleForm.ruleType !== "earn_attendance" && (
              <div className="form-field">
                <label className="field-label">Min spend (centavos)</label>
                <input
                  type="number"
                  min="0"
                  value={ruleForm.minAmountCents}
                  onChange={(e) => setRuleForm({ ...ruleForm, minAmountCents: e.target.value })}
                />
              </div>
            )}
            <div className="form-field">
              <label className="field-label">Status</label>
              <select
                value={ruleForm.status}
                onChange={(e) => setRuleForm({ ...ruleForm, status: e.target.value })}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Description</label>
              <input
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
              />
            </div>
          </form>
        )}

        {sidebarMode === "reward" && (
          <form id="loyalty-sidebar-form" onSubmit={saveReward} className="form-grid">
            <div className="form-field">
              <label className="field-label">Code</label>
              <input
                required
                value={rewardForm.code}
                onChange={(e) => setRewardForm({ ...rewardForm, code: e.target.value })}
                disabled={Boolean(rewardForm.id)}
              />
            </div>
            <div className="form-field">
              <label className="field-label">Type</label>
              <select
                value={rewardForm.rewardType}
                onChange={(e) => setRewardForm({ ...rewardForm, rewardType: e.target.value })}
              >
                {REWARD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Name</label>
              <input
                required
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
              />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Description</label>
              <input
                value={rewardForm.description}
                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="field-label">Points cost</label>
              <input
                type="number"
                min="1"
                required
                value={rewardForm.pointsCost}
                onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="field-label">Inventory limit</label>
              <input
                type="number"
                min="0"
                value={rewardForm.inventoryLimit}
                onChange={(e) => setRewardForm({ ...rewardForm, inventoryLimit: e.target.value })}
                placeholder="Blank = unlimited"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Status</label>
              <select
                value={rewardForm.status}
                onChange={(e) => setRewardForm({ ...rewardForm, status: e.target.value })}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Terms</label>
              <input
                value={rewardForm.terms}
                onChange={(e) => setRewardForm({ ...rewardForm, terms: e.target.value })}
              />
            </div>
          </form>
        )}

        {sidebarMode === "adjust" && (
          <form id="loyalty-sidebar-form" onSubmit={handleAdjust} className="form-grid">
            <div className="form-field form-field--full">
              <label className="field-label">Fan email</label>
              <input
                type="email"
                required
                value={adjust.fanEmail}
                onChange={(e) => setAdjust({ ...adjust, fanEmail: e.target.value })}
              />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Quick adjust</label>
              <div className="points-delta-input">
                <button type="button" onClick={() => setAdjust({ ...adjust, pointsDelta: 100 })}>
                  +100
                </button>
                <button type="button" onClick={() => setAdjust({ ...adjust, pointsDelta: 500 })}>
                  +500
                </button>
                <button type="button" onClick={() => setAdjust({ ...adjust, pointsDelta: -100 })}>
                  −100
                </button>
              </div>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Points delta (+/−)</label>
              <input
                type="number"
                required
                value={adjust.pointsDelta}
                onChange={(e) => setAdjust({ ...adjust, pointsDelta: e.target.value })}
              />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Reason / note</label>
              <input
                required
                value={adjust.note}
                onChange={(e) => setAdjust({ ...adjust, note: e.target.value })}
                placeholder="Matchday bonus, correction"
              />
            </div>
          </form>
        )}
      </FormSidebar>
    </div>
  );
}
