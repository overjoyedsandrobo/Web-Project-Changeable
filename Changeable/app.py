from datetime import datetime, timezone
import json
import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("CHANGEABLE_SECRET", "dev-changeable-secret")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("CHANGEABLE_DB_URI", "sqlite:///changeable.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["TESTING"] = os.getenv("CHANGEABLE_TESTING") == "1"

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"  # type: ignore[assignment]

db_initialized = False


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class UserState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
    state_json = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Design(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    is_public = db.Column(db.Boolean, default=False, nullable=False)
    state_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@app.before_request
def init_db():
    global db_initialized
    if not db_initialized:
        db.create_all()
        db_initialized = True

@app.route("/")
def index():
    return render_template(
        "index.html",
        project_name="Changeable",
        is_authenticated=current_user.is_authenticated,
        username=current_user.username if current_user.is_authenticated else None,
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        user = User.query.filter_by(username=username).first()
        if not user or not user.check_password(password):
            flash("Invalid username or password.", "error")
            return redirect(url_for("login"))

        login_user(user)
        return redirect(url_for("index"))

    return render_template("login.html", project_name="Changeable")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if len(username) < 3 or len(password) < 6:
            flash("Username must be 3+ chars and password 6+ chars.", "error")
            return redirect(url_for("signup"))

        existing = User.query.filter_by(username=username).first()
        if existing:
            flash("Username already exists.", "error")
            return redirect(url_for("signup"))

        user = User()
        user.username = username
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        login_user(user)
        return redirect(url_for("index"))

    return render_template("signup.html", project_name="Changeable")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("index"))


@app.route("/api/state", methods=["GET", "POST"])
@login_required
def user_state():
    if request.method == "GET":
        state = UserState.query.filter_by(user_id=current_user.id).first()
        if not state:
            return jsonify({"state": None})
        return jsonify({"state": state.state_json})

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON"}), 400

    state = UserState.query.filter_by(user_id=current_user.id).first()
    state_json = payload if isinstance(payload, str) else json.dumps(payload)

    if not state:
        state = UserState()
        state.user_id = current_user.id
        state.state_json = state_json
        db.session.add(state)
    else:
        state.state_json = state_json
        state.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/designs", methods=["GET", "POST"])
@login_required
def designs():
    if request.method == "GET":
        scope = request.args.get("scope", "private")
        include_state = request.args.get("include_state", "0") == "1"
        private_only = request.args.get("private_only", "0") == "1"
        if scope == "public":
            rows = Design.query.filter_by(is_public=True).order_by(Design.created_at.desc()).all()
        else:
            query = Design.query.filter_by(user_id=current_user.id)
            if private_only:
                query = query.filter_by(is_public=False)
            rows = query.order_by(Design.created_at.desc()).all()
        return jsonify({
            "designs": [
                {
                    "id": d.id,
                    "name": d.name,
                    "is_public": d.is_public,
                    "user_id": d.user_id,
                    "created_at": d.created_at.isoformat(),
                    "state": json.loads(d.state_json) if include_state else None,
                }
                for d in rows
            ]
        })

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON"}), 400

    name = str(payload.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Name required"}), 400

    is_public = bool(payload.get("is_public", False))
    state = payload.get("state")
    if state is None:
        return jsonify({"error": "State required"}), 400

    def normalize_state(obj):
        if isinstance(obj, str):
            try:
                obj = json.loads(obj)
            except Exception:
                return ""
        if isinstance(obj, dict):
            obj = dict(obj)
            obj.pop("ruleColors", None)
        return json.dumps(obj, sort_keys=True, separators=(",", ":"))

    # Name must be unique across public + user's designs
    name_exists = Design.query.filter(
        or_(Design.is_public == True, Design.user_id == current_user.id),
        Design.name == name,
    ).first()
    if name_exists:
        return jsonify({"error": "Name already exists"}), 400

    # Design (state) must be unique across public + user's designs
    incoming_sig = normalize_state(state)
    if incoming_sig:
        candidates = Design.query.filter(
            or_(Design.is_public == True, Design.user_id == current_user.id)
        ).all()
        for d in candidates:
            if normalize_state(d.state_json) == incoming_sig:
                return jsonify({"error": "Design already exists"}), 400

    design = Design()
    design.user_id = current_user.id
    design.name = name[:120]
    design.is_public = is_public
    design.state_json = json.dumps(state)
    db.session.add(design)
    db.session.commit()
    return jsonify({"ok": True, "id": design.id})


@app.route("/api/designs/<int:design_id>", methods=["GET"])
@login_required
def design_detail(design_id: int):
    design = Design.query.filter_by(id=design_id).first()
    if not design:
        return jsonify({"error": "Not found"}), 404

    if not design.is_public and design.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({
        "id": design.id,
        "name": design.name,
        "is_public": design.is_public,
        "user_id": design.user_id,
        "created_at": design.created_at.isoformat(),
        "state": json.loads(design.state_json),
    })


@app.route("/api/designs/<int:design_id>", methods=["DELETE"])
@login_required
def design_delete(design_id: int):
    design = Design.query.filter_by(id=design_id).first()
    if not design:
        return jsonify({"error": "Not found"}), 404

    if design.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(design)
    db.session.commit()
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(debug=True)
