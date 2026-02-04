from conftest import signup_and_login


def make_state(seed=1):
    return {
        "cols": 4,
        "rows": 4,
        "seed": seed,
        "grid": [
            [1, 0, 0, 0],
            [0, 2, 0, 0],
            [0, 0, 3, 0],
            [0, 0, 0, 4],
        ],
        "showGrid": True,
        "activeRule": 1,
        "randomizeSeed": False,
        "undoStack": [],
        "redoStack": [],
    }


def test_save_and_list_private_design(client):
    signup_and_login(client, "bob", "password123")
    resp = client.post(
        "/api/designs",
        json={"name": "my-private", "is_public": False, "state": make_state()},
    )
    assert resp.status_code == 200

    resp = client.get("/api/designs?scope=private")
    data = resp.get_json()
    assert len(data["designs"]) == 1
    assert data["designs"][0]["name"] == "my-private"


def test_name_must_be_unique_across_public_and_user_private(client):
    signup_and_login(client, "carol", "password123")
    client.post(
        "/api/designs",
        json={"name": "shared", "is_public": True, "state": make_state(1)},
    )

    # Same user cannot reuse name in private
    resp = client.post(
        "/api/designs",
        json={"name": "shared", "is_public": False, "state": make_state(2)},
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Name already exists"


def test_design_must_be_unique_across_public_and_user_private(client):
    signup_and_login(client, "dan", "password123")
    state = make_state(7)
    client.post("/api/designs", json={"name": "one", "is_public": False, "state": state})

    resp = client.post("/api/designs", json={"name": "two", "is_public": True, "state": state})
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Design already exists"


def test_delete_design(client):
    signup_and_login(client, "erin", "password123")
    resp = client.post(
        "/api/designs",
        json={"name": "delete-me", "is_public": False, "state": make_state(9)},
    )
    design_id = resp.get_json()["id"]

    resp = client.delete(f"/api/designs/{design_id}")
    assert resp.status_code == 200

    resp = client.get("/api/designs?scope=private")
    data = resp.get_json()
    assert len(data["designs"]) == 0


def test_public_private_filters_and_include_state(client):
    signup_and_login(client, "frank", "password123")
    client.post("/api/designs", json={"name": "pub", "is_public": True, "state": make_state(1)})
    client.post("/api/designs", json={"name": "priv", "is_public": False, "state": make_state(2)})

    resp = client.get("/api/designs?scope=public")
    data = resp.get_json()
    assert len(data["designs"]) == 1
    assert data["designs"][0]["name"] == "pub"

    resp = client.get("/api/designs?scope=private&private_only=1")
    data = resp.get_json()
    assert len(data["designs"]) == 1
    assert data["designs"][0]["name"] == "priv"

    resp = client.get("/api/designs?scope=public&include_state=1")
    data = resp.get_json()
    assert data["designs"][0]["state"] is not None


def test_design_detail_permissions(client):
    signup_and_login(client, "gwen", "password123")
    resp = client.post("/api/designs", json={"name": "gwen-pub", "is_public": True, "state": make_state(3)})
    pub_id = resp.get_json()["id"]
    resp = client.post("/api/designs", json={"name": "gwen-priv", "is_public": False, "state": make_state(4)})
    priv_id = resp.get_json()["id"]

    client.get("/logout")
    signup_and_login(client, "harry", "password123")

    resp = client.get(f"/api/designs/{pub_id}")
    assert resp.status_code == 200

    resp = client.get(f"/api/designs/{priv_id}")
    assert resp.status_code == 403


def test_design_validation_errors(client):
    signup_and_login(client, "ian", "password123")
    resp = client.post("/api/designs", json={"name": "", "is_public": False, "state": make_state(1)})
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Name required"

    resp = client.post("/api/designs", json={"name": "x", "is_public": False})
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "State required"


def test_delete_forbidden_for_non_owner(client):
    signup_and_login(client, "jill", "password123")
    resp = client.post("/api/designs", json={"name": "owned", "is_public": False, "state": make_state(5)})
    design_id = resp.get_json()["id"]

    client.get("/logout")
    signup_and_login(client, "kate", "password123")

    resp = client.delete(f"/api/designs/{design_id}")
    assert resp.status_code == 403


def test_invalid_json_payload(client):
    signup_and_login(client, "leo", "password123")
    resp = client.post(
        "/api/designs",
        data="not-json",
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Invalid JSON"
