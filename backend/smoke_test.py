"""Quick end-to-end smoke test of the API. Run: python smoke_test.py"""
from fastapi.testclient import TestClient

from app.main import app


def run():
    with TestClient(app) as c:
        # --- auth ---
        r = c.post("/api/auth/login", json={"email": "demo@example.com", "password": "x"})
        assert r.status_code == 200, r.text
        h = {"Authorization": f"Bearer {r.json()['token']}"}
        assert c.get("/api/auth/me", headers=h).status_code == 200
        assert c.get("/api/zones").status_code == 401  # no token -> 401

        # --- zones ---
        r = c.get("/api/zones", headers=h)
        assert r.status_code == 200 and r.json()["total"] >= 1  # seeded zone
        r = c.post("/api/zones", json={"name": "Smoke-Test.dev", "type": "public", "comment": "hi"}, headers=h)
        assert r.status_code == 201, r.text
        z = r.json()
        assert z["name"] == "smoke-test.dev." and z["record_count"] == 2 and len(z["name_servers"]) == 4
        zid = z["id"]
        assert c.post("/api/zones", json={"name": "smoke-test.dev"}, headers=h).status_code == 409
        assert c.post("/api/zones", json={"name": "not_a_domain"}, headers=h).status_code == 400
        r = c.get("/api/zones?search=smoke", headers=h)
        assert r.json()["total"] == 1
        r = c.patch(f"/api/zones/{zid}", json={"comment": "updated"}, headers=h)
        assert r.json()["comment"] == "updated"

        # --- records ---
        r = c.post(f"/api/zones/{zid}/records", json={"name": "www", "type": "a", "ttl": 300, "values": ["192.0.2.1"]}, headers=h)
        assert r.status_code == 201 and r.json()["name"] == "www.smoke-test.dev."
        rid = r.json()["id"]
        assert c.post(f"/api/zones/{zid}/records", json={"name": "www", "type": "A", "values": ["192.0.2.2"]}, headers=h).status_code == 409
        assert c.post(f"/api/zones/{zid}/records", json={"name": "bad", "type": "A", "values": ["not-an-ip"]}, headers=h).status_code == 400
        assert c.post(f"/api/zones/{zid}/records", json={"name": "", "type": "CNAME", "values": ["x.com."]}, headers=h).status_code == 400  # apex CNAME
        r = c.put(f"/api/zones/{zid}/records/{rid}", json={"name": "web", "type": "A", "ttl": 60, "values": ["192.0.2.9"]}, headers=h)
        assert r.status_code == 200 and r.json()["name"] == "web.smoke-test.dev." and r.json()["ttl"] == 60
        r = c.get(f"/api/zones/{zid}/records?search=web", headers=h)
        assert r.json()["total"] == 1
        r = c.get(f"/api/zones/{zid}/records?type=NS", headers=h)
        assert r.json()["total"] == 1

        # default record protection + zone-not-empty
        soa_id = next(x["id"] for x in c.get(f"/api/zones/{zid}/records?type=SOA", headers=h).json()["items"])
        assert c.delete(f"/api/zones/{zid}/records/{soa_id}", headers=h).status_code == 400
        assert c.delete(f"/api/zones/{zid}", headers=h).status_code == 409  # non-default record exists

        # export
        assert "$ORIGIN smoke-test.dev." in c.get(f"/api/zones/{zid}/export?format=bind", headers=h).text
        assert c.get(f"/api/zones/{zid}/export?format=json", headers=h).json()["hosted_zone"]["id"] == zid

        # bulk delete then zone delete
        r = c.post(f"/api/zones/{zid}/records/bulk-delete", json={"ids": [rid, soa_id]}, headers=h)
        assert r.json() == {"deleted": 1, "skipped_default": 1}
        assert c.delete(f"/api/zones/{zid}", headers=h).status_code == 200
        assert c.get(f"/api/zones/{zid}", headers=h).status_code == 404

        # logout kills the session
        c.post("/api/auth/logout", headers=h)
        assert c.get("/api/auth/me", headers=h).status_code == 401

    print("ALL SMOKE TESTS PASSED ✔")


if __name__ == "__main__":
    run()
