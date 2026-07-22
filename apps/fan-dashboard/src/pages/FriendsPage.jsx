import SharedInfoPage from "./SharedInfoPage.jsx";

export default function FriendsPage() {
  document.title = "Friends — Coxa";

  return (
    <SharedInfoPage
      eyebrow="Social"
      title="Friends"
      description="Find fellow supporters, track who is attending, and jump back into community features from a proper screen."
      sections={[
        {
          label: "People you may know",
          items: [
            { icon: "👥", iconClass: "fan-ios-row__icon--green", label: "Matchday group", detail: "See which friends are confirmed for the next home match" },
            { icon: "🤝", iconClass: "fan-ios-row__icon--gold", label: "Invite a fan", detail: "Share your referral code and bring someone into the club" },
            { icon: "💬", iconClass: "fan-ios-row__icon--orange", label: "Community replies", detail: "Keep up with conversations you joined recently" },
          ],
        },
      ]}
      actions={[
        { to: "/community", label: "Open community feed" },
        { to: "/membership/referrals", label: "View referrals" },
      ]}
    />
  );
}
