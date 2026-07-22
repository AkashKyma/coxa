import SharedInfoPage from "./SharedInfoPage.jsx";

export default function HelpPage() {
  document.title = "Help Centre — Coxa";

  return (
    <SharedInfoPage
      eyebrow="Assistance"
      title="Help Centre"
      description="A single place for common self-service guidance across tickets, wallet, rewards, and membership."
      sections={[
        {
          label: "Most common tasks",
          items: [
            { icon: "🎫", iconClass: "fan-ios-row__icon--green", label: "Open my ticket QR", detail: "Find your active ticket and expand the QR code at the gate" },
            { icon: "👤", iconClass: "fan-ios-row__icon--ink", label: "Update my profile", detail: "Edit contact details, address, and fan preferences" },
            { icon: "🔔", iconClass: "fan-ios-row__icon--gold", label: "Manage notifications", detail: "Choose ticket, rewards, and membership alerts" },
          ],
        },
      ]}
      actions={[
        { to: "/profile/edit", label: "Edit profile" },
        { to: "/settings", label: "Open settings" },
      ]}
    />
  );
}
