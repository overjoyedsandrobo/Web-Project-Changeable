from conftest import signup_and_login


def test_state_save_and_load(client):
    signup_and_login(client, "stateuser", "password123")
    payload = {"cols": 4, "rows": 4, "grid": [[0, 1, 0, 0]] * 4}
    resp = client.post("/api/state", json=payload)
    assert resp.status_code == 200

    resp = client.get("/api/state")
    data = resp.get_json()
    assert data["state"] is not None
