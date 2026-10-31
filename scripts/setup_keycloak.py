"""Reconcile the local demo realm using the Admin API; preserve existing users/passwords."""
import json
from urllib.parse import quote
from common import ROOT, admin_token, read_env, request


def main():
    config = json.loads((ROOT / "keycloak/lab-config.json").read_text(encoding="utf-8"))
    env = read_env()
    for user in config["users"]:
        if not env.get("TEST_" + user["username"].upper() + "_PASSWORD"):
            raise RuntimeError("Run scripts/init_env.py and fill all demo passwords first")
    token = admin_token()
    def api(path, method="GET", data=None):
        return request(path, method, data, token)
    realm = config["realm"]
    base = "/admin/realms/" + realm
    if realm not in [r["realm"] for r in api("/admin/realms")]:
        api("/admin/realms", "POST", {"realm": realm, "enabled": True, "registrationAllowed": False})
    roles = {r["name"]: r for r in api(base + "/roles")}
    for name in config["roles"]:
        if name not in roles:
            api(base + "/roles", "POST", {"name": name})
    roles = {r["name"]: r for r in api(base + "/roles")}
    desired = config["client"]
    clients = api(base + "/clients?clientId=" + quote(desired["clientId"]))
    if not clients:
        api(base + "/clients", "POST", desired)
        clients = api(base + "/clients?clientId=" + quote(desired["clientId"]))
    client = clients[0]
    client_path = base + "/clients/" + client["id"]
    merged = {**client, **desired, "attributes": {**client.get("attributes", {}), **desired["attributes"]}}
    # Mapper reconciliation is done separately through its own endpoint.
    merged.pop("protocolMappers", None)
    api(client_path, "PUT", merged)
    mapper = config["audienceMapper"]
    existing = next((m for m in api(client_path + "/protocol-mappers/models") if m["name"] == mapper["name"]), None)
    if existing:
        api(client_path + "/protocol-mappers/models/" + existing["id"], "PUT", {**mapper, "id": existing["id"]})
    else:
        api(client_path + "/protocol-mappers/models", "POST", mapper)
    for user in config["users"]:
        username = user["username"]
        matches = api(base + "/users?exact=true&username=" + quote(username))
        if not matches:
            api(base + "/users", "POST", {
                "username": username, "enabled": True, "firstName": user["role"].capitalize(),
                "lastName": "Demo", "email": username + "@example.test", "emailVerified": True,
                "credentials": [{"type": "password", "temporary": False,
                                 "value": env["TEST_" + username.upper() + "_PASSWORD"]}],
            })
            matches = api(base + "/users?exact=true&username=" + quote(username))
        user_path = base + "/users/" + matches[0]["id"]
        assigned = api(user_path + "/role-mappings/realm")
        # A demo user must have exactly its intended application role.
        wrong = [r for r in assigned if r["name"] in config["roles"] and r["name"] != user["role"]]
        if wrong:
            raise RuntimeError(f"{username} has conflicting application roles; review role mappings before continuing")
        if user["role"] not in [r["name"] for r in assigned]:
            api(user_path + "/role-mappings/realm", "POST", [roles[user["role"]]])
        print("Ready:", username, "->", user["role"], "(existing password preserved)")
    events = api(base + "/events/config")
    events.update({"eventsEnabled": True, "eventsExpiration": 604800,
                   "adminEventsEnabled": True, "adminEventsDetailsEnabled": False})
    events["enabledEventTypes"] = sorted(set(events.get("enabledEventTypes", [])) |
                                         {"LOGIN", "LOGIN_ERROR", "LOGOUT", "CODE_TO_TOKEN", "CODE_TO_TOKEN_ERROR"})
    api(base + "/events/config", "PUT", events)
    print("Ready: company-iam / employee-portal / PKCE S256 / audience employee-api / events")


if __name__ == "__main__":
    main()
