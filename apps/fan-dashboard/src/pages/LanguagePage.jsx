import SharedInfoPage from "./SharedInfoPage.jsx";

export default function LanguagePage() {
  document.title = "Language — Coxa";

  const currentLanguage = localStorage.getItem("coxa_language") || "pt-BR";

  return (
    <SharedInfoPage
      eyebrow="Preferences"
      title="Language"
      description={`Your current app language is ${currentLanguage}. You can also change it from the main settings screen.`}
      sections={[
        {
          label: "Available languages",
          items: [
            { icon: "🇧🇷", iconClass: "fan-ios-row__icon--green", label: "Português (BR)", detail: currentLanguage === "pt-BR" ? "Currently selected" : "Available" },
            { icon: "🇬🇧", iconClass: "fan-ios-row__icon--ink", label: "English", detail: currentLanguage === "en" ? "Currently selected" : "Available" },
            { icon: "🇪🇸", iconClass: "fan-ios-row__icon--gold", label: "Español", detail: currentLanguage === "es" ? "Currently selected" : "Available" },
          ],
        },
      ]}
      actions={[
        { to: "/settings", label: "Change language in settings" },
      ]}
    />
  );
}
