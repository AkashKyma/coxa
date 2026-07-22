import SharedInfoPage from "./SharedInfoPage.jsx";

export default function VotesPage() {
  document.title = "Votes — Coxa";

  return (
    <SharedInfoPage
      eyebrow="Fan voice"
      title="Votes"
      description="Club votes, supporter decisions, and official participation moments now resolve to a real screen instead of a dead end."
      sections={[
        {
          label: "Open participation",
          items: [
            { icon: "🗳️", iconClass: "fan-ios-row__icon--green", label: "Supporter poll", detail: "Choose the walkout song for the next home match" },
            { icon: "🏅", iconClass: "fan-ios-row__icon--gold", label: "Man of the match", detail: "Cast your official vote after the final whistle" },
            { icon: "📋", iconClass: "fan-ios-row__icon--ink", label: "Club consultation", detail: "Share your opinion on matchday experience improvements" },
          ],
        },
      ]}
      actions={[
        { to: "/polls", label: "Open live polls" },
        { to: "/predictions", label: "Make your match predictions" },
      ]}
    />
  );
}
