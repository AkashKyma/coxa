import SharedInfoPage from "./SharedInfoPage.jsx";

export default function VideosPage() {
  document.title = "Videos — Coxa";

  return (
    <SharedInfoPage
      eyebrow="Media"
      title="Videos"
      description="Watch club highlights, training clips, and post-match content without falling into an empty route."
      sections={[
        {
          label: "Featured now",
          items: [
            { icon: "🎥", iconClass: "fan-ios-row__icon--green", label: "Match highlights", detail: "Coritiba 2–1 Athletico · 8 min" },
            { icon: "🏋️", iconClass: "fan-ios-row__icon--gold", label: "Training session", detail: "Behind-the-scenes clips from the week" },
            { icon: "🎙️", iconClass: "fan-ios-row__icon--orange", label: "Coach interview", detail: "Press conference and tactical recap" },
          ],
        },
      ]}
      actions={[
        { to: "/news", label: "Read club news" },
        { to: "/community", label: "Join the fan community" },
      ]}
    />
  );
}
