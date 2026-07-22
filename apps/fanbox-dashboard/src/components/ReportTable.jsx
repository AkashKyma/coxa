import { useMemo, useState } from "react";

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toCsv(rows, columns) {
  const esc = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    if (!/[,"\n]/.test(text)) return text;
    return `"${text.replace(/"/g, "\"\"")}"`;
  };
  const header = columns.map((col) => esc(col.label)).join(",");
  const lines = rows.map((row) => columns.map((col) => esc(row[col.key])).join(","));
  return [header, ...lines].join("\n");
}

export default function ReportTable({ title, rows = [], columns = [], csvFilename = "report.csv" }) {
  const [sort, setSort] = useState({ key: null, direction: "asc" });

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const cloned = [...rows];
    cloned.sort((a, b) => {
      const av = a?.[sort.key];
      const bv = b?.[sort.key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sort.direction === "asc" ? av - bv : bv - av;
      }
      return sort.direction === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return cloned;
  }, [rows, sort]);

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }

  function exportCsv() {
    const csv = toCsv(sortedRows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = csvFilename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel-card">
      <div className="panel-card__head">
        <h3>{title}</h3>
        <button type="button" className="btn btn--ghost btn--sm" onClick={exportCsv} disabled={!sortedRows.length}>
          Export CSV
        </button>
      </div>
      <div className="panel-card__body panel-card__body--flush">
        {!sortedRows.length ? (
          <p className="empty-state panel-card__empty">No records available.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>
                  <button
                    type="button"
                    className="sort-btn"
                    onClick={() => toggleSort(col.key)}
                    disabled={col.sortable === false}
                  >
                    {col.label}
                    {sort.key === col.key ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr key={row.id ?? row._id ?? `${idx}-${title}`}>
                {columns.map((col) => (
                  <td key={`${col.key}-${row.id ?? row._id ?? idx}`}>
                    {col.render ? col.render(row[col.key], row) : formatCell(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
