import Keycloak from 'keycloak-js';
export default new Keycloak({url:import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',realm:import.meta.env.VITE_KEYCLOAK_REALM || 'company-iam',clientId:import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'security-dashboard'});
