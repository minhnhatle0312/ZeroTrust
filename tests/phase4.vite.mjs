import path from 'node:path';
import {fileURLToPath} from 'node:url';
import configuration from './phase2.vite.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export default {...configuration,envDir:path.join(root,'.runtime/phase4-tests/empty-env'),build:{...configuration.build,outDir:path.join(root,'.runtime/phase4-tests/build',process.env.IAM_BUILD_APP)}};
