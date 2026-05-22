import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// import LanguageDetector from "i18next-browser-languagedetector"; // Removido

import ptTranslation from "./locales/pt/translation.json";

i18n
  // .use(LanguageDetector) // Removido
  .use(initReactI18next)
  .init({
    resources: {
      pt: {
        translation: ptTranslation,
      },
    },
    lng: "pt", // Definir português como a língua padrão
    fallbackLng: "pt", // Default language if detection fails
    debug: false, // Set to true for debugging
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
  });

export default i18n;