import Keycloak from "keycloak-js";

export const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM || "company-iam",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "employee-portal",
};
const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
