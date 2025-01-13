import os

from database import (
    Position,
    init_db,
)
from dotenv import load_dotenv
from error_routes import error_routes
from flask import (
    Flask,
    Response,
    g,
    json,
    render_template,
    request,
    session,
    stream_with_context,
    url_for,
)
from flask_socketio import SocketIO, emit, join_room
from item_routes import item_routes
from procurement_routes import procurement_routes
from report_routes import report_routes
from rfq_routes import rfq_routes
from scrap_gred import init_scraper
from user_routes import user_routes
from utils import (
    SocketDataKey,
    check_token,
    init_logger,
    init_mail,
    on_ajax_render,
    openai_response,
    require_fields,
)
from vendor_routes import vendor_routes

load_dotenv()

app = Flask(__name__, template_folder="../dist", static_folder="../dist/static")
init_logger(app)
init_mail(app)
init_db(app)
init_scraper(app)

app.config["SERVER_NAME"] = (
    os.environ["PROD_SERVER_NAME"]
    if os.environ["PRODUCTION"] == "1"
    else "localhost:5000"
)
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]
app.config["FLASK_PYDANTIC_VALIDATION_ERROR_RAISE"] = True

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="gevent_uwsgi" if os.environ["PRODUCTION"] == "1" else "gevent",
    path="/socket.io",
    # pingTimeout=60000,
    # pingInterval=25000,
    # maxHttpBufferSize=1e8,
    transports=["polling", "websocket"],
    debug=True,
)


@app.route("/")
@on_ajax_render("index.html")
def index():
    return render_template("index.html")


app.register_blueprint(error_routes)
app.register_blueprint(user_routes)
app.register_blueprint(vendor_routes)
app.register_blueprint(item_routes)
app.register_blueprint(procurement_routes)
app.register_blueprint(report_routes)
app.register_blueprint(rfq_routes)


@app.route("/developer_dashboard")
@on_ajax_render("dev_dashboard.html")
def developer_dashboard():
    return render_template("index.html", redirect_url=url_for("developer_dashboard"))


@app.route("/dashboard")
@on_ajax_render("dashboard.html")
def dashboard():
    return render_template("index.html", redirect_url="/dashboard")


@app.route("/dashboard/vendor")
@on_ajax_render("vendor.html")
def vendor():
    return render_template("index.html", redirect_url="/dashboard/vendor")


@app.route("/dashboard/procurement")
@on_ajax_render("procurement.html")
def procurement():
    return render_template("index.html", redirect_url="/dashboard/procurement")


@app.route("/dashboard/item")
@on_ajax_render("item.html")
def item():
    return render_template("index.html", redirect_url="/dashboard/item")


@app.route("/dashboard/report")
@on_ajax_render("report.html")
def report():
    return render_template("index.html", redirect_url="/dashboard/report")


@app.route("/dashboard/user_manual")
@on_ajax_render("user_manual.html")
def user_manual():
    return render_template("index.html", redirect_url="/dashboard/user_manual")


@app.route("/dashboard/quotation")
@on_ajax_render("quotation.html")
def quotation():
    return render_template("quotation.html", redirect_url="/dashboard/quotation")


@app.route("/dashboard/users")
@on_ajax_render("users.html")
def users():
    return render_template("index.html", redirect_url="/dashboard/users")


@app.route("/consult", methods=["POST"])
@require_fields(["input"])
def consult(data):
    query = data.get("input")

    if not query:
        return "Query parameter is required.", 400

    streaming = data.get("streaming", True)

    headers = {
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache",
    }

    if not streaming:
        response = "".join(
            chunk or "" for chunk in openai_response(query, streaming=False)
        )
        return Response(response, content_type="text/plain")

    generator = (
        chunk for chunk in openai_response(query, streaming=True) if chunk is not None
    )

    return Response(
        stream_with_context(generator),
        content_type="text/plain",
        headers=headers,
    )


@socketio.on("connect", namespace="/data")
@check_token()
def handle_connect():
    valid_keys = [
        key
        for key, role in SocketDataKey.__members__.items()
        if Position[g.user["role"]].value >= role.value.value
    ]

    keys = request.args.get("keys")

    if keys:
        try:
            keys = json.loads(keys)
        except Exception:
            emit("unauthorized", {"error": "Invalid keys format"})
            return False

        invalid_keys = [key for key in keys if key not in valid_keys]
        if invalid_keys:
            emit("unauthorized", {"error": f"Invalid keys: {invalid_keys}"})
            return False

        for key in keys:
            join_room(key)

    session.update(
        {
            "email": g.user["uid"],
            "role": g.user["role"],
            "keys": keys,
            "allow_keys": valid_keys,
        }
    )
    app.logger.debug(
        f"Client {g.user['email']} ({g.user['role']}) subscribed to keys: {keys}"
    )
    return True


@socketio.on("disconnect", namespace="/data")
def handle_disconnect():
    session.clear()
    app.logger.debug("Client disconnected and session cleared")


@socketio.on("update-keys", namespace="/data")
def handle_update_keys(new_keys):
    valid_keys = session.get("allow_keys", [])
    invalid_keys = [key for key in new_keys if key not in valid_keys]

    if invalid_keys:
        emit("unauthorized", {"error": f"Invalid keys: {invalid_keys}"})
        return False

    for key in new_keys:
        join_room(key)

    session.update({"keys": new_keys})
    app.logger.debug(f"Client {session.get('email')} updated keys: {new_keys}")
    return True


if __name__ == "__main__":
    socketio.run(app, debug=True)
