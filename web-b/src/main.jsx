import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import keycloak,{keycloakConfig} from './keycloak.js';
import {AuthGate} from '../../shared/auth.jsx';
import {publishSession} from '../../shared/session.mjs';
import './style.css';
import {rememberIncidentRoute} from './security-data.mjs';

// Preserve only validated incident navigation across an existing OIDC redirect.
try{rememberIncidentRoute(window.location.hash,window.sessionStorage);}catch{}

createRoot(document.getElementById('root')).render(
  <AuthGate keycloak={keycloak} identityConfig={keycloakConfig} app="B" apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:3001'}
    otherUrl={import.meta.env.VITE_PORTAL_URL || 'http://localhost:5173/'}>
    <App onDenied={()=>publishSession({state:'denied',code:'DASHBOARD_ACCESS_DENIED'})}/>
  </AuthGate>,
);
