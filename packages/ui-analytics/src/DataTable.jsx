import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Columns3, Download, Search,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────
function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getCellText(value, col, row) {
  if (col.render) {
    const rendered = col.render(value, row);
    if (typeof rendered === "string" || typeof rendered === "number") return String(rendered);
  }
  return formatCell(value);
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[,"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => esc(getCellText(row[c.key], c, row))).join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadBlob(content, filename, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZES = [20, 50, 100, 200];

// ─── DataTable ───────────────────────────────────────────────────────────────
/**
 * DataTable — fully-featured, shared table component.
 *
 * Props:
 *   title       – string
 *   rows        – array of objects
 *   columns     – [{ key, label, sortable?, filterable?, render?, width? }]
 *   csvFilename – string
 *   pageSize    – initial page size (default 20)
 *   loading     – boolean
 *   onRowClick  – fn(row)
 *   actions     – extra JSX in header
 */
export default function DataTable({
  title,
  rows = [],
  columns = [],
  csvFilename = "export.csv",
  pageSize: initialPageSize = 20,
  loading = false,
  onRowClick,
  actions,
}) {
  const [sorts, setSorts]             = useState([]);
  const [colFilters, setColFilters]   = useState({});
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(initialPageSize);
  const [hiddenCols, setHiddenCols]   = useState(new Set());
  const [showColChooser, setShowColChooser] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");

  const visibleCols = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols]
  );

  // Global + per-column filtering
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // per-column
      const colMatch = visibleCols.every((col) => {
        const filter = colFilters[col.key];
        if (!filter) return true;
        return String(row[col.key] ?? "").toLowerCase().includes(filter.toLowerCase());
      });
      if (!colMatch) return false;
      // global search
      if (globalFilter) {
        const q = globalFilter.toLowerCase();
        return Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q));
      }
      return true;
    });
  }, [rows, visibleCols, colFilters, globalFilter]);

  // Multi-sort
  const sortedRows = useMemo(() => {
    if (!sorts.length) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      for (const { key, dir } of sorts) {
        const av = a[key], bv = b[key];
        if (av === bv) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }, [filteredRows, sorts]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [sortedRows, page, pageSize]
  );

  function toggleSort(key) {
    setSorts((prev) => {
      const existing = prev.find((s) => s.key === key);
      if (!existing) return [{ key, dir: "asc" }, ...prev.filter((s) => s.key !== key)].slice(0, 3);
      if (existing.dir === "asc") return prev.map((s) => s.key === key ? { key, dir: "desc" } : s);
      return prev.filter((s) => s.key !== key);
    });
    setPage(1);
  }

  function getSortIcon(key) {
    const s = sorts.find((x) => x.key === key);
    if (!s) return <ChevronUp size={12} strokeWidth={2} className="dt-sort-icon dt-sort-icon--idle" />;
    return s.dir === "asc"
      ? <ChevronUp   size={12} strokeWidth={2.5} className="dt-sort-icon dt-sort-icon--active" />
      : <ChevronDown size={12} strokeWidth={2.5} className="dt-sort-icon dt-sort-icon--active" />;
  }

  function setColFilter(key, val) {
    setColFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  }

  function exportCsv() {
    downloadBlob(toCsv(sortedRows, visibleCols), csvFilename);
  }

  function toggleCol(key) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const startRow = sortedRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow   = Math.min(page * pageSize, sortedRows.length);

  return (
    <section className="panel-card data-table-card">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="panel-card__head">
        <h3 className="dt-title">{title}</h3>
        <div className="dt-toolbar">
          {actions}

          {/* Global search */}
          <div className="dt-search-wrap">
            <Search size={13} className="dt-search-icon" strokeWidth={2} />
            <input
              className="dt-search-input"
              placeholder="Search…"
              value={globalFilter}
              onChange={(e) => { setGlobalFilter(e.target.value); setPage(1); }}
            />
          </div>

          {/* Column chooser toggle */}
          <button
            type="button"
            className="dt-ctrl-btn"
            onClick={() => setShowColChooser((v) => !v)}
            title="Show / hide columns"
          >
            <Columns3 size={14} strokeWidth={2} />
            <span>Columns</span>
          </button>

          {/* Export */}
          <button
            type="button"
            className="dt-ctrl-btn"
            onClick={exportCsv}
            disabled={!sortedRows.length}
            title="Export CSV"
          >
            <Download size={14} strokeWidth={2} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── Column chooser ──────────────────────────────── */}
      {showColChooser && (
        <div className="dt-col-chooser">
          {columns.map((col) => (
            <label key={col.key} className="dt-col-chooser__item">
              <input
                type="checkbox"
                checked={!hiddenCols.has(col.key)}
                onChange={() => toggleCol(col.key)}
                className="dt-col-chooser__checkbox"
              />
              <span>{col.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* ── Table body ──────────────────────────────────── */}
      <div className="panel-card__body panel-card__body--flush">
        {loading ? (
          <p className="dt-empty">Loading…</p>
        ) : !pagedRows.length ? (
          <p className="dt-empty">No records match your filters.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {visibleCols.map((col) => (
                    <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                      <button
                        type="button"
                        className={`sort-btn${sorts.find((s) => s.key === col.key) ? " sort-btn--active" : ""}`}
                        onClick={() => col.sortable !== false && toggleSort(col.key)}
                        disabled={col.sortable === false}
                      >
                        <span>{col.label}</span>
                        {getSortIcon(col.key)}
                      </button>
                      {col.filterable !== false && (
                        <input
                          className="dt-col-filter"
                          placeholder="Filter…"
                          value={colFilters[col.key] ?? ""}
                          onChange={(e) => setColFilter(col.key, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, idx) => (
                  <tr
                    key={row.id ?? row._id ?? idx}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? "data-table__row--clickable" : ""}
                  >
                    {visibleCols.map((col) => (
                      <td key={col.key}>
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

      {/* ── Pagination ──────────────────────────────────── */}
      {!loading && sortedRows.length > 0 && (
        <div className="dt-pagination">
          {/* Row count info */}
          <span className="dt-pagination__info">
            {startRow}–{endRow} <span className="dt-pagination__of">of</span> {sortedRows.length.toLocaleString()}
          </span>

          {/* Nav buttons */}
          <div className="dt-pagination__nav">
            <button
              type="button"
              className="dt-page-btn"
              disabled={page === 1}
              onClick={() => setPage(1)}
              title="First page"
            >
              <ChevronsLeft size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="dt-page-btn"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              title="Previous page"
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </button>

            {/* Page pills */}
            <div className="dt-pagination__pages">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="dt-pagination__ellipsis">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`dt-page-btn dt-page-btn--num${p === page ? " dt-page-btn--current" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>

            <button
              type="button"
              className="dt-page-btn"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              title="Next page"
            >
              <ChevronRight size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="dt-page-btn"
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
              title="Last page"
            >
              <ChevronsRight size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Page size selector */}
          <select
            className="dt-pagesize-select"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            title="Rows per page"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>
      )}
    </section>
  );
}
