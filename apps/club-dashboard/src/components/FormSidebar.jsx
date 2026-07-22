import { useEffect } from "react";
import { X } from "lucide-react";

export default function FormSidebar({ open, title, description, onClose, children, footer, width }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="form-sidebar-backdrop" onClick={onClose} role="presentation">
      <aside
        className="form-sidebar"
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="form-sidebar__head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="form-sidebar__close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="form-sidebar__body">{children}</div>
        {footer && <div className="form-sidebar__foot">{footer}</div>}
      </aside>
    </div>
  );
}
