export const EVENT_STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  on_sale: "On sale",
  sold_out: "Sold out",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function eventStatusBadge(status) {
  const map = {
    draft: "event-status--draft",
    published: "event-status--published",
    on_sale: "event-status--sale",
    sold_out: "event-status--soldout",
    completed: "event-status--completed",
    cancelled: "event-status--cancelled",
  };
  return map[status] ?? "event-status--draft";
}

export function ticketStatusBadge(status) {
  const map = {
    issued: "event-status--sale",
    used: "event-status--completed",
    cancelled: "event-status--cancelled",
    transferred: "event-status--published",
  };
  return map[status] ?? "event-status--draft";
}

export function formatEventDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
