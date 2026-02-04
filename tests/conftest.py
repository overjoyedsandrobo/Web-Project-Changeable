import os
import sys
import importlib
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


@pytest.fixture()
def app():
    os.environ["CHANGEABLE_TESTING"] = "1"
    os.environ["CHANGEABLE_DB_URI"] = "sqlite:///:memory:"

    import Changeable.app as app_module
    importlib.reload(app_module)

    app = app_module.app
    with app.app_context():
        app_module.db.drop_all()
        app_module.db.create_all()

    yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def signup_and_login(client, username="tester", password="password123"):
    client.post(
        "/signup",
        data={"username": username, "password": password},
        follow_redirects=True,
    )
