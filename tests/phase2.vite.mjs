// Build the real applications with public fixture endpoints, without reading lab .env files.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import react from '../web-a/node_modules/@vitejs/plugin-react/dist/index.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=process.env.IAM_BUILD_APP;
if(!['web-a','web-b'].includes(app))throw Error('Select web-a or web-b');
export default {
  root:path.join(root,app),
  envDir:path.join(root,'.runtime/phase2-tests/empty-env'),
  base:app==='web-a'?'/a/':'/b/',
  plugins:[react()],resolve:{dedupe:['react','react-dom']},
  define:{
    'import.meta.env.VITE_KEYCLOAK_URL':JSON.stringify('/fixture-idp'),
    'import.meta.env.VITE_KEYCLOAK_REALM':JSON.stringify('company-iam'),
    'import.meta.env.VITE_KEYCLOAK_CLIENT_ID':JSON.stringify(app==='web-a'?'employee-portal':'security-dashboard'),
    'import.meta.env.VITE_API_URL':JSON.stringify('/fixture-api'),
    'import.meta.env.VITE_SECURITY_URL':JSON.stringify('/b/'),
    'import.meta.env.VITE_PORTAL_URL':JSON.stringify('/a/'),
  },
  build:{outDir:path.join(root,'.runtime/phase2-tests/build',app),emptyOutDir:false,sourcemap:false},
};
