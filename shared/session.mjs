const flights=new WeakMap();
export const terminalCodes=new Set(['INVALID_TOKEN','SESSION_REVOKED','SSO_SESSION_ENDED','ACCOUNT_DISABLED','MFA_SETUP_REQUIRED','REQUIRED_ACTION_PENDING','DIRECTORY_ACCESS_CHANGED','GOVERNANCE_HOLD']);

export async function renewAccessToken(keycloak,minValidity=30) {
  const current=flights.get(keycloak);
  if(current){await current.promise;if(minValidity<0&&current.minValidity>=0)return renewAccessToken(keycloak,minValidity);return;}
  const flight={minValidity,promise:null};
  flight.promise=Promise.resolve().then(()=>keycloak.updateToken(minValidity)).finally(()=>{if(flights.get(keycloak)===flight)flights.delete(keycloak);});
  flights.set(keycloak,flight);
  return flight.promise;
}
export function publishSession(detail) {
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('iam:session',{detail}));
}
