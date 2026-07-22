import SharedInfoPage from "./SharedInfoPage.jsx";

export default function FaqPage() {
  document.title = "FAQ — Coxa";

  return (
    <SharedInfoPage
      eyebrow="Knowledge base"
      title="FAQ"
      description="Quick answers for the questions supporters ask most often."
      sections={[
        {
          label: "Popular answers",
          items: [
            { icon: "❓", iconClass: "fan-ios-row__icon--green", label: "Where do I find my tickets?", detail: "Use the Tickets tab to open active orders and gate QR codes" },
            { icon: "💰", iconClass: "fan-ios-row__icon--gold", label: "How do rewards work?", detail: "Points accumulate from purchases, attendance, and membership actions" },
            { icon: "🛡️", iconClass: "fan-ios-row__icon--ink", label: "How do I manage privacy settings?", detail: "Open Privacy & Consent to export data or review permissions" },
          ],
        },
      ]}
      actions={[
        { to: "/support", label: "Contact support" },
        { to: "/consent", label: "Review privacy & consent" },
      ]}
    />
  );
}
