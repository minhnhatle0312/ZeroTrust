import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import keycloak,{keycloakConfig} from './keycloak.js';
import {AuthGate} from '../../shared/auth.jsx';
import {publishSession} from '../../shared/session.mjs';
import './App.css';

createRoot(document.getElementById('root')).render(
  <AuthGate keycloak={keycloak} identityConfig={keycloakConfig} app="A" apiUrl={import.meta.env.VITE_API_URL || 'http://localhost:3001'}
    otherUrl={import.meta.env.VITE_SECURITY_URL || 'http://localhost:5174/'}>
    <App onDenied={()=>publishSession({state:'denied',code:'DASHBOARD_ACCESS_DENIED'})}/>
  </AuthGate>,
);
