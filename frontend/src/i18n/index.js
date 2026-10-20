import km from "./km.json";
import en from "./en.json";

export const translations = { km, en };

export function getTranslation(lang = "en", keyPath = "") {
  const dict = translations[lang] || translations.en;
  const keys = keyPath.split(".");
  let current = dict;
  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = current[k];
    } else {
      return keyPath;
    }
  }
  return current;
}
