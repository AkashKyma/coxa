import { useEffect, useMemo, useState } from "react";

function resolveRowKey(row, index, rowKey) {
  if (typeof rowKey === "function") return rowKey(row, index);
  if (typeof rowKey === "string") return row?.[rowKey] ?? index;
  return index;
}

function cellContent(column, row, index) {
  if (column.render) return column.render(row, index);
  if (typeof column.accessor === "function") return column.accessor(row, index);
  if (column.accessor) return row[column.accessor];
  if (column.key) return row[column.key];
  return null;
}

/**
 * Shared data table with white background and optional client-side pagination.
 *
 * @param {Object} props
 * @param {Array<{ key?: string, header: React.ReactNode, accessor?: string|function, render?: function, className?: string, headerClassName?: string }>} props.columns
 * @param {Array} props.data
 * @param {Array} [props.rows] — alias for `data` (prefer `data`)
 * @param {string|function} [props.rowKey="id"]
 * @param {string} [props.emptyMessage="No data"]
 * @param {boolean} [props.loading=false]
 * @param {string} [props.loadingMessage="Loading…"]
 * @param {number} [props.pageSize=10]
 * @param {number[]} [props.pageSizeOptions=[10, 25, 50]]
 * @param {boolean} [props.pagination=true]
 * @param {string} [props.className=""]
 * @param {boolean} [props.dense=false]
 */
export default function DataTable({
  columns,
  data: dataProp = [],
  rows,
  rowKey = "id",
  emptyMessage = "No data",
  loading = false,
  loadingMessage = "Loading…",
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  pagination = true,
  className = "",
  dense = false,
}) {
  const data = rows ?? dataProp;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPageSize(initialPageSize);
  }, [initialPageSize]);

  useEffect(() => {
    setPage(1);
  }, [data.length, pageSize]);

  const total = data.length;
  const paginated = pagination && pageSize > 0;
  const pageCount = paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const safePage = Math.min(page, pageCount);

  const visibleRows = useMemo(() => {
    if (!paginated || total <= pageSize) return data;
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, paginated, pageSize, safePage, total]);

  const rangeStart = total === 0 ? 0 : paginated ? (safePage - 1) * pageSize + 1 : 1;
  const rangeEnd = paginated ? Math.min(safePage * pageSize, total) : total;
  const showPageControls = paginated && total > pageSize;

  return (
    <div className={`coxa-data-table-wrapper${className ? ` ${className}` : ""}`}>
      <div className="coxa-data-table-scroll">
        <table className={`coxa-data-table${dense ? " coxa-data-table--dense" : ""}`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key ?? col.header} className={col.headerClassName}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="coxa-data-table__empty">
                  {loadingMessage}
                </td>
              </tr>
            ) : total === 0 ? (
              <tr>
                <td colSpan={columns.length} className="coxa-data-table__empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const absoluteIndex = paginated ? (safePage - 1) * pageSize + index : index;
                return (
                  <tr key={resolveRowKey(row, absoluteIndex, rowKey)}>
                    {columns.map((col) => (
                      <td key={col.key ?? col.header} className={col.className}>
                        {cellContent(col, row, absoluteIndex)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading && total > 0 && (
        <div className="coxa-data-table__footer">
          <span className="coxa-data-table__info">
            Showing {rangeStart}–{rangeEnd} of {total}
          </span>
          {showPageControls && (
            <div className="coxa-data-table__controls">
              <label className="coxa-data-table__page-size">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="coxa-data-table__page-btn"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="coxa-data-table__page-indicator">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                className="coxa-data-table__page-btn"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
