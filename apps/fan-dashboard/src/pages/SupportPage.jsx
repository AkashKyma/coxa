import SharedInfoPage from "./SharedInfoPage.jsx";

export default function SupportPage() {
  document.title = "Support — Coxa";

  return (
    <SharedInfoPage
      eyebrow="Help"
      title="Support"
      description="Get the right contact path for tickets, membership, and digital access without dropping onto a blank page."
      sections={[
        {
          label: "Support channels",
          items: [
            { icon: "🎟️", iconClass: "fan-ios-row__icon--green", label: "Ticketing help", detail: "Seat changes, payment issues, and QR access support" },
            { icon: "💳", iconClass: "fan-ios-row__icon--gold", label: "Membership service", detail: "Renewal, billing, and plan upgrade questions" },
            { icon: "📱", iconClass: "fan-ios-row__icon--orange", label: "App support", detail: "Login recovery, notifications, and device issues" },
          ],
        },
      ]}
      actions={[
        { to: "/help", label: "Open help centre" },
        { to: "/faq", label: "Read FAQ" },
      ]}
    />
  );
}
