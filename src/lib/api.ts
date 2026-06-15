const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const shouldUseDevProxy =
  import.meta.env.DEV &&
  (configuredApiBaseUrl === "" ||
    configuredApiBaseUrl === "http://survey-general-api.test");

export const API_BASE_URL = shouldUseDevProxy
  ? "/api"
  : configuredApiBaseUrl || "/api";
