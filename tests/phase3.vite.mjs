import path from 'node:path';
import configuration from './phase2.vite.mjs';
export default {...configuration,envDir:path.resolve('../.runtime/phase3-tests/empty-env'),build:{...configuration.build,outDir:path.resolve('../.runtime/phase3-tests/build',process.env.IAM_BUILD_APP)}};
