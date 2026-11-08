from pathlib import Path
for name in ['web-a/src/App.jsx','web-b/src/App.jsx']:
    p=Path(name);s=p.read_text(encoding='utf-8')
    start=s.index('async function api(')
    end=s.index('\nfunction Badge',start) if name.startswith('web-a') else s.index('\nexport default function',start)
    s=s[:start]+"const api=createApi(keycloak,{baseUrl:API});\n"+s[end:]
    s="import {createApi} from '../../shared/api.mjs';\n"+s
    p.write_text(s,encoding='utf-8')
