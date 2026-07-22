import { useEffect, useState } from "react";

function toInputDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export default function DateRangeFilter({ value, onChange }) {
  const [from, setFrom] = useState(toInputDate(value?.from));
  const [to, setTo] = useState(toInputDate(value?.to));

  useEffect(() => {
    setFrom(toInputDate(value?.from));
    setTo(toInputDate(value?.to));
  }, [value?.from, value?.to]);

  function apply() {
    onChange?.({ from: from || undefined, to: to || undefined });
  }

  function clearRange() {
    setFrom("");
    setTo("");
    onChange?.({});
  }

  return (
    <div className="date-range-filter">
      <label className="date-range-filter__field">
        <span>From</span>
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="date-range-filter__field">
        <span>To</span>
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button type="button" className="btn btn--primary" onClick={apply}>
        Apply
      </button>
      <button type="button" className="btn btn--ghost" onClick={clearRange}>
        Clear
      </button>
    </div>
  );
}
