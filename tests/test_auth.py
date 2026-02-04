from conftest import signup_and_login


def test_signup_login_logout(client):
    resp = client.post(
        "/signup",
        data={"username": "alice", "password": "password123"},
        follow_redirects=True,
    )
    assert resp.status_code == 200

    resp = client.get("/logout", follow_redirects=True)
    assert resp.status_code == 200

    resp = client.post(
        "/login",
        data={"username": "alice", "password": "password123"},
        follow_redirects=True,
    )
    assert resp.status_code == 200


def test_login_required_for_designs(client):
    resp = client.get("/api/designs")
    assert resp.status_code in (302, 401)
