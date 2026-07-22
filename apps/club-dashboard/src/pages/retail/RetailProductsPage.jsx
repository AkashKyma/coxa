import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api, formatBrl } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";
import {
  RETAIL_KIND_OPTIONS,
  applyProductKindDefaults,
  defaultLocationForSegment,
  filterLocationsForSegment,
  getProductKindConfig,
  productKindLabel,
  todayDateInput,
} from "../../lib/productCatalogUtils.js";

function buildEmptyCreateForm(locations) {
  return {
    productKind: "merchandise",
    name: "",
    description: "",
    categoryId: "",
    skuCode: "",
    barcode: "",
    priceCents: "",
    variantLabel: "",
    initialQty: "0",
    initialLocationId: defaultLocationForSegment(locations, "retail"),
  };
}

function buildEditingState(item) {
  const sku = item.skus?.[0];
  const p = item.product;
  return {
    productId: p.id,
    skuId: sku?.id,
    productKind: p.productKind ?? "merchandise",
    name: p.name,
    description: p.description ?? "",
    categoryId: p.categoryId ?? "",
    status: p.status ?? "active",
    trackLots: Boolean(p.trackLots),
    storageClass: p.storageClass ?? "ambient",
    defaultShelfLifeDays: p.defaultShelfLifeDays != null ? String(p.defaultShelfLifeDays) : "",
    sellByBufferDays: p.sellByBufferDays != null ? String(p.sellByBufferDays) : "1",
    variantLabel: sku?.variantLabel ?? "",
    barcode: sku?.barcode ?? "",
    priceCents: sku ? (sku.priceCents / 100).toFixed(2) : "",
    skuStatus: sku?.status ?? "active",
  };
}

export default function RetailProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState("create");
  const [form, setForm] = useState(buildEmptyCreateForm([]));
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const createLocations = useMemo(
    () => filterLocationsForSegment(locations, "retail"),
    [locations],
  );

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const tableRows = useMemo(
    () =>
      products.map((item) => ({
        id: item.product.id,
        item,
        product: item.product,
        skus: item.skus ?? [],
        categoryName: categoryById[item.product.categoryId] ?? "—",
      })),
    [products, categoryById],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (filterCategory && row.product.categoryId !== filterCategory) return false;
      if (!q) return true;
      const inName = row.product.name?.toLowerCase().includes(q);
      const inDesc = row.product.description?.toLowerCase().includes(q);
      const inSku = row.skus.some(
        (s) =>
          s.skuCode?.toLowerCase().includes(q) ||
          s.variantLabel?.toLowerCase().includes(q) ||
          s.barcode?.toLowerCase().includes(q),
      );
      return inName || inDesc || inSku;
    });
  }, [tableRows, searchQuery, filterCategory]);

  function load() {
    setLoading(true);
    Promise.all([api.listProducts(), api.listLocations(), api.listCategories()])
      .then(async ([res, locs, cats]) => {
        setLocations(locs.data);
        setCategories(cats.data);
        const withSkus = await Promise.all(res.data.map((p) => api.getProduct(p.id).then((r) => r.data)));
        setProducts(withSkus);
        setForm((f) => ({
          ...f,
          initialLocationId:
            f.initialLocationId ||
            defaultLocationForSegment(locs.data, getProductKindConfig(f.productKind).segment),
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setSidebarMode("create");
    setEditing(null);
    setForm(buildEmptyCreateForm(locations));
    setSidebarOpen(true);
  }

  function startEdit(item) {
    setSidebarMode("edit");
    setEditing(buildEditingState(item));
    setSidebarOpen(true);
  }

  function handleCategoryChange(categoryId) {
    setForm((prev) => ({ ...prev, categoryId }));
  }

  function handleEditingKindChange(kind) {
    const config = getProductKindConfig(kind);
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            productKind: kind,
            trackLots: config.trackLotsDefault,
            storageClass: config.defaultStorage,
            defaultShelfLifeDays:
              config.defaultShelfLifeDays != null ? String(config.defaultShelfLifeDays) : "",
            sellByBufferDays: String(config.sellByBufferDays),
          }
        : prev,
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);

    const qty = Number(form.initialQty) || 0;

    if (!form.priceCents || Number(form.priceCents) < 0) {
      setError("Price is required for retail products.");
      return;
    }

    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        categoryId: form.categoryId || undefined,
        productKind: "merchandise",
        trackLots: false,
        initialQty: qty,
        initialLocationId: form.initialLocationId || undefined,
        skus: [
          {
            skuCode: form.skuCode,
            barcode: form.barcode || undefined,
            variantLabel: form.variantLabel || undefined,
            priceCents: Math.round(Number(form.priceCents || 0) * 100),
          },
        ],
      };

      await api.createProduct(body);
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await api.updateProduct(editing.productId, {
        name: editing.name,
        description: editing.description || undefined,
        categoryId: editing.categoryId || null,
        status: editing.status,
        productKind: "merchandise",
      });
      if (editing.skuId) {
        await api.updateSku(editing.skuId, {
          variantLabel: editing.variantLabel || undefined,
          barcode: editing.barcode || undefined,
          priceCents: Math.round(Number(editing.priceCents || 0) * 100),
          status: editing.skuStatus,
        });
      }
      setSidebarOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    {
      key: "product",
      header: "Product",
      render: (row) => (
        <div className="product-table__name">
          <strong>{row.product.name}</strong>
          {row.product.description ? (
            <span className="product-table__desc">{row.product.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.categoryName,
    },
    {
      key: "skus",
      header: "SKU / variant",
      render: (row) =>
        row.skus.length === 0 ? (
          <span className="muted">No SKUs</span>
        ) : (
          <ul className="product-table__skus">
            {row.skus.map((s) => (
              <li key={s.id}>
                <code>{s.skuCode}</code>
                {s.variantLabel ? (
                  <span className="product-table__variant">{s.variantLabel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "price",
      header: "Price",
      render: (row) => {
        if (row.skus.length === 0) return "—";
        const prices = row.skus.map((s) => s.priceCents);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === max) return <strong>{formatBrl(min)}</strong>;
        return (
          <strong>
            {formatBrl(min)} – {formatBrl(max)}
          </strong>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`status-pill ${
            row.product.status === "active" ? "event-status--published" : "event-status--soldout"
          }`}
        >
          {row.product.status ?? "active"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "product-table__actions",
      render: (row) => (
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => startEdit(row.item)}
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Retail Products"
        description="Merchandise catalog — jerseys, caps, scarves and retail items sold at stores."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Add product
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <div className="toolbar product-table-toolbar">
        <div className="product-search">
          <Search className="product-search__icon" size={18} strokeWidth={2} aria-hidden />
          <input
            type="text"
            className="product-search__input"
            placeholder="Search by name, SKU, variant or barcode…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search products"
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery ? (
            <button
              type="button"
              className="product-search__clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="product-table-toolbar__filters">
          <label className="product-filter">
            <span className="product-filter__label">Category</span>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <span className="product-table-toolbar__count">
            {filteredRows.length} of {products.length} product{products.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        rowKey="id"
        loading={loading}
        loadingMessage="Loading products…"
        emptyMessage={
          products.length === 0
            ? "No retail products yet. Add your first item."
            : "No products match your filters."
        }
        pagination={filteredRows.length > 10}
      />

      <FormSidebar
        open={sidebarOpen}
        title={sidebarMode === "create" ? "Add retail product" : "Edit retail product"}
        description={
          sidebarMode === "create"
            ? "Retail merchandise sold at stadium stores."
            : "Update product and SKU details."
        }
        onClose={() => {
          setSidebarOpen(false);
          setEditing(null);
        }}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSidebarOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" form="product-form" className="btn btn--primary">
              {sidebarMode === "create" ? "Create product" : "Save changes"}
            </button>
          </>
        }
      >
        {sidebarMode === "create" ? (
          <form id="product-form" onSubmit={handleCreate} className="form-grid">
            <div className="form-field form-field--full">
              <label className="field-label">Product name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Home Kit Jersey 2025"
              />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional short description"
              />
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field form-field--full product-form-divider">
              <span className="field-label">SKU &amp; pricing</span>
            </div>
            <div className="form-field">
              <label className="field-label">SKU code *</label>
              <input
                required
                value={form.skuCode}
                onChange={(e) => setForm({ ...form, skuCode: e.target.value })}
                placeholder="e.g. JRY-HOME-25"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Price (R$) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.priceCents}
                onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Variant</label>
              <input
                value={form.variantLabel}
                onChange={(e) => setForm({ ...form, variantLabel: e.target.value })}
                placeholder="e.g. Size M"
              />
            </div>
            <div className="form-field">
              <label className="field-label">Barcode</label>
              <input
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>

            <div className="form-field form-field--full product-form-divider">
              <span className="field-label">Opening stock</span>
            </div>
            <div className="form-field form-field--full">
              <label className="field-label">Store location</label>
              <select
                value={form.initialLocationId}
                onChange={(e) => setForm({ ...form, initialLocationId: e.target.value })}
              >
                {createLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="field-label">Initial quantity</label>
              <input
                type="number"
                min="0"
                value={form.initialQty}
                onChange={(e) => setForm({ ...form, initialQty: e.target.value })}
              />
            </div>
          </form>
        ) : (
          editing && (
            <form id="product-form" onSubmit={saveEdit} className="form-grid">
              <div className="form-field form-field--full">
                <label className="field-label">Product name *</label>
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="form-field form-field--full">
                <label className="field-label">Description</label>
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label className="field-label">Category</label>
                <select
                  value={editing.categoryId}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="field-label">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {editing.skuId && (
                <>
                  <div className="form-field form-field--full product-form-divider">
                    <span className="field-label">SKU</span>
                  </div>
                  <div className="form-field">
                    <label className="field-label">Variant</label>
                    <input
                      value={editing.variantLabel}
                      onChange={(e) => setEditing({ ...editing, variantLabel: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Price (R$) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={editing.priceCents}
                      onChange={(e) => setEditing({ ...editing, priceCents: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Barcode</label>
                    <input
                      value={editing.barcode}
                      onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">SKU status</label>
                    <select
                      value={editing.skuStatus}
                      onChange={(e) => setEditing({ ...editing, skuStatus: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </>
              )}
            </form>
          )
        )}
      </FormSidebar>
    </div>
  );
}
