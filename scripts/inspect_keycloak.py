import json
from common import ROOT, admin_token, request

token = admin_token()
realms = request("/admin/realms", token=token)
report = {"realms": [r["realm"] for r in realms]}
if "company-iam" in report["realms"]:
    base = "/admin/realms/company-iam"
    report["roles"] = [r["name"] for r in request(base + "/roles", token=token)]
    report["clients"] = [{k: c.get(k) for k in (
        "id", "clientId", "enabled", "publicClient", "standardFlowEnabled",
        "directAccessGrantsEnabled", "redirectUris", "webOrigins", "attributes", "protocolMappers"
    )} for c in request(base + "/clients", token=token) if c["clientId"] in ("employee-portal", "employee-api", "attendance-control")]
    report["users"] = []
    for u in request(base + "/users?max=100", token=token):
        if u["username"] in ("admin01", "manager01", "employee01", "auditor01", "manager02", "employee02"):
            roles = request(base + "/users/" + u["id"] + "/role-mappings/realm/composite", token=token)
            report["users"].append({"username": u["username"], "enabled": u["enabled"], "requiredActions": u.get("requiredActions", []), "roles": [r["name"] for r in roles]})
    report["events"] = request(base + "/events/config", token=token)
print(json.dumps(report, ensure_ascii=False, indent=2))
