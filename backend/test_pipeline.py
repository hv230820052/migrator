import urllib.request
import urllib.parse
import json
import time
import sys

BASE_URL = "http://localhost:8000"

def post(path, data=None):
    url = f"{BASE_URL}{path}"
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    req = urllib.request.Request(url, data=req_data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def get(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def test_pipeline():
    print("=== PROVENANCE MIGRATION VERIFICATION ===", flush=True)
    
    print("\n--- 1. Connect Source ---", flush=True)
    st, res = post("/api/sources", {
        "type": "svn",
        "endpoint": "/app/data/messy-svn-repo"
    })
    print(f"Connect source ({st}): {res}", flush=True)

    print("\n--- 2. Create Run ---", flush=True)
    st, res = post("/api/runs", {
        "source_ids": [1],
        "target_org": "octathon-target"
    })
    print(f"Create run ({st}): {res}", flush=True)
    run_id = res["run_id"]

    print(f"\n--- 3. Discover (Run {run_id}) ---", flush=True)
    st, res = post(f"/api/runs/{run_id}/discover")
    print(f"Discover trigger ({st}): {res}", flush=True)
    
    print("Waiting for discovery...", flush=True)
    time.sleep(3)
    st, repos = get("/api/catalog")
    print(f"Catalog ({len(repos)} repos): {[r['name'] for r in repos]}", flush=True)

    repo_id = 1

    print(f"\n--- 4. Curate Secrets & Dead Branches (Run {run_id}) ---", flush=True)
    st, res = post(f"/api/runs/{run_id}/curate")
    print(f"Curate trigger ({st}): {res}", flush=True)
    time.sleep(2)
    st, findings = get(f"/api/repos/{repo_id}/findings")
    print(f"Findings found: {len(findings)}", flush=True)
    for f in findings:
        print(f"  [{f['severity'].upper()}] {f['type']}: {f['location']} -> {f['recommendation']}", flush=True)

    print(f"\n--- 5. Assess Risk Score (Run {run_id}) ---", flush=True)
    st, res = post(f"/api/runs/{run_id}/assess")
    print(f"Assess trigger ({st}): {res}", flush=True)
    time.sleep(2)
    st, risk = get(f"/api/repos/{repo_id}/risk")
    print(f"Risk Assessment: Level={risk.get('risk')} Score={risk.get('score')} Effort={risk.get('effort_estimate')}", flush=True)
    for factor in risk.get("factors", []):
        print(f"  - {factor}", flush=True)

    print(f"\n--- 6. Identity Cartographer Mappings (Repo {repo_id}) ---", flush=True)
    st, mappings = get(f"/api/repos/{repo_id}/mappings")
    print(f"Author Mappings ({len(mappings)}):", flush=True)
    for m in mappings:
        print(f"  Legacy '{m['legacy_id']}' -> GitHub '{m['proposed_login']}' <{m['proposed_email']}> (Tier: {m['tier']}, Status: {m['status']})", flush=True)

    print(f"\n--- 7. Approve Hard Gates (T3 Governance) ---", flush=True)
    for gate in ["PLAN", "MAPPINGS", "SECRETS", "CUTOVER"]:
        st, res = post(f"/api/runs/{run_id}/gates/{gate}", {
            "gate": gate,
            "actor": "auditor_sec_lead",
            "decision": "approve",
            "reason": f"Auditor verified {gate} compliance"
        })
        print(f"Gate {gate}: {res.get('status', res.get('decision'))} by {res.get('actor')}", flush=True)

    print(f"\n--- 8. Execute Agentic Migration (Run {run_id}) ---", flush=True)
    st, res = post(f"/api/runs/{run_id}/migrate")
    print(f"Migrate trigger ({st}): {res}", flush=True)

    print("Waiting for migration to complete...", flush=True)
    for i in range(15):
        time.sleep(2)
        st, stats = get(f"/api/runs/{run_id}/cascade/stats")
        print(f"  [{i*2}s] Token spend={stats['budget_used']}/{stats['budget_limit']} (Tripped={stats['budget_tripped']})", flush=True)

    print("\n=== PIPELINE RUN FINISHED ===", flush=True)

if __name__ == "__main__":
    test_pipeline()
