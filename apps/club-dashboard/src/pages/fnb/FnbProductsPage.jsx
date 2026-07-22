import { useEffect, useMemo, useState } from 'react';
import { Search, X, UtensilsCrossed } from 'lucide-react';
import { api, formatBrl } from '../../lib/api.js';
import PageHeader from '../../components/PageHeader.jsx';
import FormSidebar from '../../components/FormSidebar.jsx';
import DataTable from '@coxa/ui/DataTable';
import {
  FNB_KIND_OPTIONS,
  STORAGE_CLASS_OPTIONS,
  applyProductKindDefaults,
  defaultLocationForSegment,
  filterLocationsForSegment,
  getProductKindConfig,
  productKindLabel,
  storageClassLabel,
  todayDateInput,
  dateInputFromOffset,
} from '../../lib/productCatalogUtils.js';

function buildEmpty(locations, kind) {
  const cfg = getProductKindConfig(kind);
  return {
    productKind: kind, name: '', description: '', categoryId: '',
    skuCode: '', barcode: '', priceCents: '', variantLabel: '',
    trackLots: cfg.trackLotsDefault, storageClass: cfg.defaultStorage,
    defaultShelfLifeDays: cfg.defaultShelfLifeDays != null ? String(cfg.defaultShelfLifeDays) : '',
    sellByBufferDays: String(cfg.sellByBufferDays),
    initialQty: '0',
    initialLocationId: defaultLocationForSegment(locations, 'fnb'),
    purchaseDate: todayDateInput(),
    expirationDate: cfg.defaultShelfLifeDays != null ? dateInputFromOffset(cfg.defaultShelfLifeDays) : '',
    sellByDate: '', lotNumber: '', supplierName: '',
  };
}

function buildEditing(item) {
  const sku = item.skus?.[0];
  const p = item.product;
  return {
    productId: p.id, skuId: sku?.id,
    productKind: p.productKind ?? 'menu_item', name: p.name,
    description: p.description ?? '', categoryId: p.categoryId ?? '',
    status: p.status ?? 'active', trackLots: Boolean(p.trackLots),
    storageClass: p.storageClass ?? 'chilled',
    defaultShelfLifeDays: p.defaultShelfLifeDays != null ? String(p.defaultShelfLifeDays) : '',
    sellByBufferDays: p.sellByBufferDays != null ? String(p.sellByBufferDays) : '0',
    variantLabel: sku?.variantLabel ?? '', barcode: sku?.barcode ?? '',
    priceCents: sku ? (sku.priceCents / 100).toFixed(2) : '',
    skuStatus: sku?.status ?? 'active',
  };
}

export default function FnbProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState('create');
  const [form, setForm] = useState(buildEmpty([], 'menu_item'));
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState('');

  const fnbLocations = useMemo(() => filterLocationsForSegment(locations, 'fnb'), [locations]);
  const editCfg = useMemo(() => editing ? getProductKindConfig(editing.productKind) : null, [editing]);
  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const fnbKindSet = useMemo(() => new Set(FNB_KIND_OPTIONS.map((o) => o.value)), []);

  function load() {
    setLoading(true);
    Promise.all([api.listProducts(), api.listLocations(), api.listCategories()])
      .then(async ([res, locs, cats]) => {
        setLocations(locs.data);
        setCategories(cats.data);
        const withSkus = await Promise.all(res.data.map((p) => api.getProduct(p.id).then((r) => r.data)));
        setProducts(withSkus.filter((item) => fnbKindSet.has(item.product.productKind)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setSidebarMode('create'); setEditing(null); setForm(buildEmpty(locations, 'menu_item')); setSidebarOpen(true); }
  function startEdit(item) { setSidebarMode('edit'); setEditing(buildEditing(item)); setSidebarOpen(true); }
  function handleKindChange(kind) { setForm((prev) => applyProductKindDefaults(prev, kind, locations)); }
  function handleEditKindChange(kind) {
    const cfg = getProductKindConfig(kind);
    setEditing((prev) => prev ? { ...prev, productKind: kind, trackLots: cfg.trackLotsDefault, storageClass: cfg.defaultStorage, defaultShelfLifeDays: cfg.defaultShelfLifeDays != null ? String(cfg.defaultShelfLifeDays) : '', sellByBufferDays: String(cfg.sellByBufferDays) } : prev);
  }

  async function handleCreate(e) {
    e.preventDefault(); setError(null);
    const qty = Number(form.initialQty) || 0;
    const cfg = getProductKindConfig(form.productKind);
    if (cfg.priceRequired && (!form.priceCents || Number(form.priceCents) < 0)) { setError('Price is required for this item type.'); return; }
    if (form.trackLots && qty > 0 && !form.expirationDate) { setError('Expiration date is required when receiving lot-tracked stock.'); return; }
    try {
      const body = { name: form.name, description: form.description || undefined, categoryId: form.categoryId || undefined, productKind: form.productKind, trackLots: form.trackLots, storageClass: form.storageClass, defaultShelfLifeDays: form.defaultShelfLifeDays ? Number(form.defaultShelfLifeDays) : undefined, sellByBufferDays: Number(form.sellByBufferDays) || 0, initialQty: qty, initialLocationId: form.initialLocationId || undefined, skus: [{ skuCode: form.skuCode, barcode: form.barcode || undefined, variantLabel: form.variantLabel || undefined, priceCents: Math.round(Number(form.priceCents || 0) * 100) }] };
      if (form.trackLots && qty > 0) { body.initialLot = { purchaseDate: form.purchaseDate || undefined, expirationDate: form.expirationDate, sellByDate: form.sellByDate || undefined, lotNumber: form.lotNumber || undefined, supplierName: form.supplierName || undefined, note: 'Initial lot on product create' }; }
      await api.createProduct(body); setSidebarOpen(false); load();
    } catch (err) { setError(err.message); }
  }

  async function saveEdit(e) {
    e.preventDefault(); if (!editing) return; setError(null);
    try {
      await api.updateProduct(editing.productId, { name: editing.name, description: editing.description || undefined, categoryId: editing.categoryId || null, status: editing.status, productKind: editing.productKind, trackLots: editing.trackLots, storageClass: editing.storageClass, defaultShelfLifeDays: editing.defaultShelfLifeDays ? Number(editing.defaultShelfLifeDays) : undefined, sellByBufferDays: Number(editing.sellByBufferDays) || 0 });
      if (editing.skuId) { await api.updateSku(editing.skuId, { variantLabel: editing.variantLabel || undefined, barcode: editing.barcode || undefined, priceCents: Math.round(Number(editing.priceCents || 0) * 100), status: editing.skuStatus }); }
      setSidebarOpen(false); setEditing(null); load();
    } catch (err) { setError(err.message); }
  }

  const tableRows = useMemo(() => products.map((item) => ({ id: item.product.id, item, product: item.product, skus: item.skus ?? [], categoryName: categoryById[item.product.categoryId] ?? 'None' })), [products, categoryById]);
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (filterKind && row.product.productKind !== filterKind) return false;
      if (!q) return true;
      return row.product.name?.toLowerCase().includes(q) || row.product.description?.toLowerCase().includes(q) || row.skus.some((s) => s.skuCode?.toLowerCase().includes(q) || s.variantLabel?.toLowerCase().includes(q));
    });
  }, [tableRows, searchQuery, filterKind]);

  const columns = [
    { key: 'product', header: 'Item', render: (row) => (<div className="product-table__name"><strong>{row.product.name}</strong>{row.product.description && <span className="product-table__desc">{row.product.description}</span>}</div>) },
    { key: 'type', header: 'Type', render: (row) => (<span className="status-pill event-status--draft">{productKindLabel(row.product.productKind)}</span>) },
    { key: 'category', header: 'Category', render: (row) => row.categoryName },
    { key: 'storage', header: 'Storage', render: (row) => (<span className="status-pill event-status--published">{storageClassLabel(row.product.storageClass ?? 'ambient')}</span>) },
    { key: 'skus', header: 'SKU', render: (row) => row.skus.length === 0 ? <span className="muted">No SKUs</span> : (<ul className="product-table__skus">{row.skus.map((s) => (<li key={s.id}><code>{s.skuCode}</code>{s.variantLabel && <span className="product-table__variant">{s.variantLabel}</span>}</li>))}</ul>) },
    { key: 'price', header: 'Price', render: (row) => { if (row.skus.length === 0) return '—'; const prices = row.skus.map((s) => s.priceCents); const min = Math.min(...prices), max = Math.max(...prices); return <strong>{min === max ? formatBrl(min) : formatBrl(min) + ' – ' + formatBrl(max)}</strong>; } },
    { key: 'lots', header: 'Lots', render: (row) => row.product.trackLots ? <span className="status-pill event-status--soldout">Lot tracked</span> : <span className="muted">Standard</span> },
    { key: 'status', header: 'Status', render: (row) => (<span className={'status-pill ' + (row.product.status === 'active' ? 'event-status--published' : 'event-status--soldout')}>{row.product.status ?? 'active'}</span>) },
    { key: 'actions', header: '', className: 'product-table__actions', render: (row) => (<button type="button" className="btn btn--secondary btn--sm" onClick={() => startEdit(row.item)}>Edit</button>) },
  ];

  const createCfg = getProductKindConfig(form.productKind);

  return (
    <div>
      <PageHeader title="F&amp;B Products" description="Menu items and ingredients for stands — lot tracking, storage class and shelf-life managed here." actions={<button type="button" className="btn btn--primary" onClick={openCreate}><UtensilsCrossed size={15} style={{marginRight:'0.4rem'}}/> Add item</button>} />
      {error && <div className="alert error">{error}</div>}
      <div className="toolbar product-table-toolbar">
        <div className="product-search">
          <Search className="product-search__icon" size={18} strokeWidth={2} aria-hidden />
          <input type="text" className="product-search__input" placeholder="Search by name or SKU…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoComplete="off" spellCheck={false} />
          {searchQuery && <button type="button" className="product-search__clear" onClick={() => setSearchQuery('')}><X size={16} strokeWidth={2} aria-hidden /></button>}
        </div>
        <div className="product-table-toolbar__filters">
          <label className="product-filter">
            <span className="product-filter__label">Type</span>
            <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)}>
              <option value="">All types</option>
              {FNB_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <span className="product-table-toolbar__count">{filteredRows.length} of {products.length} item{products.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <DataTable columns={columns} data={filteredRows} rowKey="id" loading={loading} loadingMessage="Loading F&amp;B catalog…" emptyMessage={products.length === 0 ? 'No F&B items yet. Add your first menu item.' : 'No items match your filters.'} pagination={filteredRows.length > 10} />
      <FormSidebar open={sidebarOpen} title={sidebarMode === 'create' ? 'Add F&B item' : 'Edit F&B item'} description={sidebarMode === 'create' ? createCfg.description : editCfg?.description ?? 'Update item details.'} onClose={() => { setSidebarOpen(false); setEditing(null); }} footer={<><button type="button" className="btn btn--ghost" onClick={() => { setSidebarOpen(false); setEditing(null); }}>Cancel</button><button type="submit" form="fnb-product-form" className="btn btn--primary">{sidebarMode === 'create' ? 'Create item' : 'Save changes'}</button></>}>
        {sidebarMode === 'create' ? (
          <form id="fnb-product-form" onSubmit={handleCreate} className="form-grid">
            <div className="form-field form-field--full"><label className="field-label">Item type *</label><select value={form.productKind} onChange={(e) => handleKindChange(e.target.value)}>{FNB_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><span className="field-hint">{createCfg.description}</span></div>
            <div className="form-field form-field--full"><label className="field-label">Item name *</label><input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="e.g. Chopp 500ml"/></div>
            <div className="form-field form-field--full"><label className="field-label">Description</label><input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}/></div>
            <div className="form-field form-field--full"><label className="field-label">Category</label><select value={form.categoryId} onChange={(e) => setForm({...form, categoryId: e.target.value})}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="form-field form-field--full product-form-divider"><span className="field-label">Food inventory settings</span></div>
            <div className="form-field"><label className="field-label">Storage class</label><select value={form.storageClass} onChange={(e) => setForm({...form, storageClass: e.target.value})}>{STORAGE_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="form-field"><label className="field-label">Default shelf life (days)</label><input type="number" min="1" value={form.defaultShelfLifeDays} onChange={(e) => setForm({...form, defaultShelfLifeDays: e.target.value})}/></div>
            <div className="form-field"><label className="field-label">Sell-by buffer (days)</label><input type="number" min="0" value={form.sellByBufferDays} onChange={(e) => setForm({...form, sellByBufferDays: e.target.value})}/></div>
            <div className="form-field form-field--full"><label className="field-label"><input type="checkbox" checked={form.trackLots} disabled={form.productKind === 'ingredient'} onChange={(e) => setForm({...form, trackLots: e.target.checked})} style={{marginRight:'0.5rem'}}/>Track lots (purchase / sell-by / expiration)</label>{form.productKind === 'ingredient' && <span className="field-hint">Ingredients always use lot tracking.</span>}</div>
            <div className="form-field form-field--full product-form-divider"><span className="field-label">SKU &amp; pricing</span></div>
            <div className="form-field"><label className="field-label">SKU code *</label><input required value={form.skuCode} onChange={(e) => setForm({...form, skuCode: e.target.value})} placeholder="e.g. FNB-CHOPP-500"/></div>
            <div className="form-field"><label className="field-label">Price (R$){createCfg.priceRequired ? ' *' : ' — optional'}</label><input type="number" min="0" step="0.01" required={createCfg.priceRequired} value={form.priceCents} onChange={(e) => setForm({...form, priceCents: e.target.value})}/>{form.productKind === 'ingredient' && <span className="field-hint">Ingredients not sold at POS.</span>}</div>
            <div className="form-field"><label className="field-label">Variant</label><input value={form.variantLabel} onChange={(e) => setForm({...form, variantLabel: e.target.value})} placeholder="e.g. 500ml"/></div>
            <div className="form-field"><label className="field-label">Barcode</label><input value={form.barcode} onChange={(e) => setForm({...form, barcode: e.target.value})}/></div>
            <div className="form-field form-field--full product-form-divider"><span className="field-label">{form.trackLots ? 'Initial lot receive' : 'Opening stock'}</span></div>
            <div className="form-field form-field--full"><label className="field-label">F&amp;B stand location</label><select value={form.initialLocationId} onChange={(e) => setForm({...form, initialLocationId: e.target.value})}><option value="">— none —</option>{fnbLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select><span className="field-hint">F&amp;B stands and central F&amp;B store only.</span></div>
            <div className="form-field"><label className="field-label">Initial quantity</label><input type="number" min="0" value={form.initialQty} onChange={(e) => setForm({...form, initialQty: e.target.value})}/></div>
            {form.trackLots && Number(form.initialQty) > 0 && (<>
              <div className="form-field"><label className="field-label">Purchase date</label><input type="date" value={form.purchaseDate} onChange={(e) => setForm({...form, purchaseDate: e.target.value})}/></div>
              <div className="form-field"><label className="field-label">Expiration date *</label><input type="date" required value={form.expirationDate} onChange={(e) => setForm({...form, expirationDate: e.target.value})}/></div>
              <div className="form-field"><label className="field-label">Sell-by date</label><input type="date" value={form.sellByDate} onChange={(e) => setForm({...form, sellByDate: e.target.value})}/></div>
              <div className="form-field"><label className="field-label">Lot / batch #</label><input value={form.lotNumber} onChange={(e) => setForm({...form, lotNumber: e.target.value})} placeholder="Auto-generated if empty"/></div>
              <div className="form-field form-field--full"><label className="field-label">Supplier</label><input value={form.supplierName} onChange={(e) => setForm({...form, supplierName: e.target.value})}/></div>
            </>)}
            {form.trackLots && Number(form.initialQty) === 0 && <p className="field-hint form-field--full">Receive lots later under F&amp;B &rarr; Food inventory.</p>}
          </form>
        ) : (editing && (
          <form id="fnb-product-form" onSubmit={saveEdit} className="form-grid">
            <div className="form-field form-field--full"><label className="field-label">Item type</label><select value={editing.productKind} onChange={(e) => handleEditKindChange(e.target.value)}>{FNB_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="form-field form-field--full"><label className="field-label">Item name *</label><input required value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})}/></div>
            <div className="form-field form-field--full"><label className="field-label">Description</label><input value={editing.description} onChange={(e) => setEditing({...editing, description: e.target.value})}/></div>
            <div className="form-field"><label className="field-label">Category</label><select value={editing.categoryId} onChange={(e) => setEditing({...editing, categoryId: e.target.value})}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="form-field"><label className="field-label">Status</label><select value={editing.status} onChange={(e) => setEditing({...editing, status: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div className="form-field form-field--full product-form-divider"><span className="field-label">Food inventory settings</span></div>
            <div className="form-field"><label className="field-label">Storage class</label><select value={editing.storageClass} onChange={(e) => setEditing({...editing, storageClass: e.target.value})}>{STORAGE_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="form-field"><label className="field-label">Shelf life (days)</label><input type="number" min="1" value={editing.defaultShelfLifeDays} onChange={(e) => setEditing({...editing, defaultShelfLifeDays: e.target.value})}/></div>
            <div className="form-field"><label className="field-label">Sell-by buffer (days)</label><input type="number" min="0" value={editing.sellByBufferDays} onChange={(e) => setEditing({...editing, sellByBufferDays: e.target.value})}/></div>
            <div className="form-field form-field--full"><label className="field-label"><input type="checkbox" checked={editing.trackLots} disabled={editing.productKind === 'ingredient'} onChange={(e) => setEditing({...editing, trackLots: e.target.checked})} style={{marginRight:'0.5rem'}}/>Track lots</label>{editing.trackLots && <p className="field-hint">Adjust lots under F&amp;B &rarr; Food inventory.</p>}</div>
            {editing.skuId && (<>
              <div className="form-field form-field--full product-form-divider"><span className="field-label">SKU</span></div>
              <div className="form-field"><label className="field-label">Variant</label><input value={editing.variantLabel} onChange={(e) => setEditing({...editing, variantLabel: e.target.value})}/></div>
              <div className="form-field"><label className="field-label">Price (R$)</label><input type="number" min="0" step="0.01" required={editCfg?.priceRequired} value={editing.priceCents} onChange={(e) => setEditing({...editing, priceCents: e.target.value})}/></div>
              <div className="form-field"><label className="field-label">Barcode</label><input value={editing.barcode} onChange={(e) => setEditing({...editing, barcode: e.target.value})}/></div>
              <div className="form-field"><label className="field-label">SKU status</label><select value={editing.skuStatus} onChange={(e) => setEditing({...editing, skuStatus: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </>)}
          </form>
        ))}
      </FormSidebar>
    </div>
  );
}
