import type { Locale } from "@/i18n/config";
import type de from "../messages/de-CH.json";

// Type-safe translation keys: using a key that does not exist in de-CH.json
// is a compile error.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof de;
  }
}
