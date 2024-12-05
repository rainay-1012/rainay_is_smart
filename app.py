import io
import logging
import os
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional

import bleach
import firebase_admin
import jwt
import pandas as pd
from dotenv import load_dotenv
from firebase_admin import auth, credentials, storage
from firebase_admin.auth import EmailAlreadyExistsError, UserNotFoundError, UserRecord
from flask import (
    Flask,
    Response,
    abort,
    g,
    jsonify,
    redirect,
    request,
    send_file,
    url_for,
)
from flask.templating import render_template
from flask_mail import Mail, Message
from google.cloud.exceptions import GoogleCloudError
from openai import OpenAI
from PIL import Image
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.datastructures.file_storage import FileStorage
from werkzeug.exceptions import HTTPException

from database import Company, Package, Position, Token, User, db, init_db

app = Flask(__name__, template_folder="dist", static_folder="dist/static")

load_dotenv()
production = os.environ["PRODUCTION"] == "1"
app.config["SERVER_NAME"] = (
    os.environ["PROD_SERVER_NAME"] if production else "localhost:5000"
)
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]
app.config["MAIL_SERVER"] = os.environ["MAIL_SERVER"]
app.config["MAIL_PORT"] = int(os.environ["MAIL_PORT"])
app.config["MAIL_USERNAME"] = os.environ["MAIL_USERNAME"]
app.config["MAIL_PASSWORD"] = os.environ["MAIL_PASSWORD"]
app.config["MAIL_USE_TLS"] = os.environ["MAIL_USE_TLS"] == "True"
app.config["MAIL_USE_SSL"] = os.environ["MAIL_USE_SSL"] == "True"
app.config["MAIL_DEFAULT_SENDER"] = os.environ["MAIL_DEFAULT_SENDER"]
app.config["MAIL_SUPPRESS_SEND"] = not production
mail = Mail(app)

init_db(app)

cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
firebase_admin.initialize_app(cred, {"storageBucket": os.environ["STORAGE_URL"]})
client = OpenAI()

bucket = storage.bucket()


@app.errorhandler(Exception)  # type: ignore
def handle_exception(e):
    # Default error details
    code = 500
    description = dict(
        title="Internal Server Error",
        body="An unexpected error occurred. Please try again later.",
    )
    print(e)
    if isinstance(e, HTTPException):
        code = e.code
        description: dict = e.description  # type: ignore

    html_content = render_template(
        "error.html",
        error_start=str(code)[0],
        error_end=str(code)[2],
        error_title=description["title"],
        error_description=description["body"],
        redirect_url=url_for("index", _external=True),
    )
    return (
        jsonify(
            {
                "status": "error",
                "code": code,
                "description": description,
                "content": html_content,
            }
        ),
        code,
    )


@app.errorhandler(404)
def page_not_found(e):
    return render_template(
        "error.html",
        error_start=4,
        error_end=4,
        error_title="Page Not Found",
        error_description="The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.",
        style=True,
        redirect_url=url_for("index", _external=True),
    )


def check_token(required_role: Optional[Position] = None):
    def decorator(f):
        @wraps(f)
        def wrap(*args, **kwargs):
            auth_header = request.headers.get("Authorization")

            if not auth_header or not auth_header.startswith("Bearer "):
                return index(request.path)

            token = auth_header.split(" ", 1)[1]

            try:
                user = auth.verify_id_token(token)
            except Exception as e:
                logging.error(f"Error verifying token: {e}")
                abort(
                    403,
                    {
                        "title": "Access Denied",
                        "body": "Your session could not be authenticated. Please log in again to continue.",
                    },
                )
            else:
                g.user = user
                print(g.user)
                if required_role:
                    if required_role == Position.admin:
                        if not user.get("admin"):
                            abort(
                                403,
                                description=f"User must have the '{required_role}' role.",
                            )
                    else:
                        uid = user["uid"]
                        user_data = db.session.get(User, uid)
                        if not user_data:
                            abort(404, "User not found.")

                        if user_data.token.position != required_role:
                            abort(
                                403,
                                description=f"User must have the '{required_role}' role.",
                            )

                return f(*args, **kwargs)

        return wrap

    return decorator


def require_fields(required_fields, source_type="json"):
    def decorator(f):
        @wraps(f)
        def wrap(*args, **kwargs):
            # Retrieve data based on the source_type
            if source_type == "json":
                data = request.get_json() or {}
            elif source_type == "form":
                data = request.form
            elif source_type == "args":
                data = request.args
            else:
                return jsonify({"message": f"Invalid source type: {source_type}"}), 400

            # Check for missing fields
            missing_fields = [field for field in required_fields if field not in data]

            if missing_fields:
                return (
                    jsonify(
                        {"message": f"Missing field(s): {', '.join(missing_fields)}"}
                    ),
                    400,
                )

            sanitized_data = {}
            for key, value in data.items():
                sanitized_data[key] = bleach.clean(value, strip=True)

            kwargs['data'] = sanitized_data
            return f(*args, **kwargs)

        return wrap

    return decorator


def on_ajax_render(template_name):
    def decorator(f):
        @wraps(f)
        def wrapped_function(*args, **kwargs):
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                print(template_name)
                return render_template(template_name)
            return f(*args, **kwargs)

        return wrapped_function

    return decorator


@app.route("/")
def index(route="/login"):
    return render_template("index.html", redirect_url=route)


@app.route("/login")
@on_ajax_render("login.html")
def login():
    return render_template("index.html", redirect_url="/login")


@app.route("/login_redirect", methods=["POST"])
@check_token()
def login_redirect():
    try:
        uid = g.user["uid"]

        f_user: UserRecord = auth.get_user(uid)

        if f_user.custom_claims and f_user.custom_claims.get("admin"):
            position = Position.admin
        else:
            user = db.session.get(User, uid)
            print(uid)
            if user is None:
                abort(404, description="User not found")

            position = user.token.position

        if position == Position.manager:
            return jsonify({"redirect_to": url_for("manager_dashboard")})
        elif position == Position.executive:
            return jsonify({"redirect_to": url_for("executive_dashboard")})
        elif position == Position.admin:
            return jsonify({"redirect_to": url_for("developer_dashboard")})

        return jsonify({"error": "Invalid email."}), 400

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/register")
@on_ajax_render("register.html")
def register():
    return render_template("index.html", redirect_url="/register")


@app.route("/is_email_verified")
def is_email_verified():
    email = request.args["email"]
    return {"verified": auth.get_user_by_email(email).email_verified}, 200


@app.route("/create_user", methods=["POST"])
@require_fields(["email", "password", "token"])
def create_user(data):
    try:
        email = data["email"]
        password = data["password"]
        token_id = data["token"]

        token = db.session.get(Token, token_id)

        if not token:
            return (
                jsonify(
                    {
                        "code": "auth/invalid-token",
                        "message": "The provided token is invalid.",
                    }
                ),
                400,
            )

        try:
            user = auth.get_user_by_email(email)
            if not user.email_verified:
                auth.delete_user(user.uid)
        except UserNotFoundError:
            pass

        user: UserRecord = auth.create_user(
            email=email, password=password, email_verified=False
        )

        signed_token = jwt.encode(
            dict(
                uid=user.uid,
                token=token.id,
                exp=datetime.now() + timedelta(hours=1),
            ),
            app.config["SECRET_KEY"],
            algorithm="HS256",
        )

        logging.info(f"User created with ID: {user.uid}")

        link = url_for("verify_email", token=signed_token, _external=True)
        app.logger.info(link)

        msg = Message(
            "Vendosync email verification",
            recipients=[email],
            html=render_template(
                "verification_email.html",
                email=email,
                verify_link=link,
            ),
        )
        mail.send(msg)

        return (
            jsonify({"message": "User created successfully", "user_email": email}),
            201,
        )

    except SQLAlchemyError as e:
        db.session.rollback()
        logging.error(f"Database error: {str(e)}")
        return jsonify({"error": "Database error"}), 500

    except EmailAlreadyExistsError:
        logging.error(f"{email} is already in use.")
        return jsonify({"error": "Email already in use"}), 400

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/verify_email")
@require_fields(["token"], source_type="args")
def verify_email(data):
    try:
        token = data["token"]
        decoded_token = jwt.decode(
            token, app.config["SECRET_KEY"], algorithms=["HS256"]
        )

        auth.get_user(decoded_token["uid"])

        db_user = User(id=decoded_token["uid"], token_id=decoded_token["token"])  # type: ignore
        db.session.add(db_user)
        db.session.commit()

        return redirect(url_for("email_verified"))
    
    except UserNotFoundError:
        return page_not_found(None)

    except SQLAlchemyError as e:
        db.session.rollback()
        logging.error(f"Database error: {str(e)}")
        return jsonify({"error": "Database error"}), 500

    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 400

    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 400

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/email_verified")
def email_verified():
    return render_template("email_verified.html")


@app.route("/create_company", methods=["POST"])
@require_fields(["name", "address", "package", "email"])
def create_company(data):
    try:
        name = data["name"]
        address = data["address"]
        email = data["email"]
        package = data["package"]

        if package not in Package._member_names_:
            return jsonify({"error": "Package is not within available options."}), 400

        package = Package[package]

        company = Company(name=name, address=address, email=email, package=package)  # type: ignore
        db.session.add(company)
        db.session.commit()

        m_token_count, e_token_count = package.value
        m_tokens = [Token(position=Position.manager, company_id=company.id) for _ in range(m_token_count)]  # type: ignore
        e_tokens = [Token(position=Position.executive, company_id=company.id) for _ in range(e_token_count)]  # type: ignore

        db.session.add_all(m_tokens)
        db.session.add_all(e_tokens)
        db.session.commit()

        msg = Message(
            "Vendosync: Thank you for purchasing the package.",
            recipients=[email],
            html=render_template(
                "company_email.html",
                name=name,
                package=package.name.title(),
                price=0.0,
                date=company.join_date,
                randomness=datetime.now(),
                token_link=url_for("download_token", id=company.id, _external=True),
            ),
        )
        mail.send(msg)

        return (
            jsonify(
                {
                    "message": "Company created successfully",
                    "company_name": company.name,
                }
            ),
            201,
        )

    except SQLAlchemyError as e:
        db.session.rollback()
        logging.error(f"Database error occurred: {str(e)}")
        return jsonify({"error": "Database error occurred."}), 500

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/get_company_data", methods=["GET"])
@check_token(Position.admin)
def get_company_data():
    companies = Company.query.all()

    # Prepare the response data
    data = [
        {
            "id": company.id,
            "name": company.name,
            "email": company.email,
            "address": company.address,
            "package": company.package.name.title(),
            "join_date": company.join_date.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for company in companies
    ]
    return jsonify(data)


@app.route("/get_token_data", methods=["GET"])
@check_token(Position.admin)
def get_token_data():
    tokens = Token.query.all()
    data = [
        {
            "id": token.id,
            "company_id": token.company_id,
            "user_id": token.user.id if token.user else None,
            "position": token.position.name.title(),
        }
        for token in tokens
    ]
    return jsonify(data)


@app.route("/download_tokens")
@require_fields(["id"], source_type="args")
def download_token(data):
    company_id = data["id"]
    tokens = db.session.query(Token).filter_by(company_id=company_id).all()

    if not tokens:
        return jsonify({"message": "Company not found"}), 404

    csv_data = {
        "Token ID": [token.id for token in tokens],
        "Position": [token.position.name for token in tokens],
    }
    df = pd.DataFrame(csv_data)
    csv_buffer = io.BytesIO()
    df.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    return send_file(
        csv_buffer, as_attachment=True, download_name=f"tokens.csv", mimetype="text/csv"
    )


@app.route("/manager_dashboard")
@check_token(Position.manager)
@on_ajax_render("mgr_dashboard.html")
def manager_dashboard():
    return render_template("index.html", redirect_url="/manager_dashboard")


@app.route("/manager_dashboard/vendor_management")
@check_token(Position.manager)
@on_ajax_render("vendor_management.html")
def manager_dashboard_vendor():
    return render_template("index.html", redirect_url="/manager_dashboard/vendor_management")

@app.route("/manager_dashboard/profile")
@check_token(Position.manager)
@on_ajax_render("profile.html")
def manager_dashboard_profile():
    return render_template("index.html", redirect_url="/manager_dashboard/profile")


@app.route("/executive_dashboard")
@check_token(Position.executive)
@on_ajax_render("exec_dashboard.html")
def executive_dashboard():
    return render_template("index.html", redirect_url="/executive_dashboard")



@app.route("/developer_dashboard")
@check_token(Position.admin)
@on_ajax_render("dev_dashboard.html")
def developer_dashboard():
    return render_template("index.html", redirect_url="/developer_dashboard")


@app.route("/get_user_info")
def get_user_info():
    try:
        user_id = g.user["uid"]
        user_record: UserRecord = auth.get_user(user_id)

        return (
            jsonify(
                {
                    "user": {
                        "username": user_record.display_name,
                        "photo_url": user_record.photo_url,
                        "photoNo": user_record.phone_number,
                    }
                }
            ),
            201,
        )

    except (ValueError, UserNotFoundError) as e:
        logging.error(
            f"The specified user ID {user_id} or properties are invalid. Detail: {e}"
        )
        return jsonify({"error": "Invalid specified user ID."}), 400

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/update_user", methods=["POST"])
def update_user():
    try:
        user_id = g.user["uid"]

        if not user_id:
            return jsonify({"error": "No user is specified"}), 400

        photo: Optional[FileStorage] = request.files.get("file")
        if photo and photo.filename:
            photo_url = upload_photo(photo, user_id)

        auth.update_user(
            uid=user_id,
            display_name=request.form.get("user_name"),
            photo_number=request.form.get("phoneNo"),
            photo_url=photo_url,
        )
        logging.info(f"User {user_id} is successfully updated.")

        return (
            jsonify({"message": "User successfully updated.", "user_id": user_id}),
            201,
        )

    except GoogleCloudError as e:
        logging.error(f"Google cloud error: {e}")
        return jsonify({"error": "An error occurred while uploading the file."}), 500

    except (ValueError, UserNotFoundError) as e:
        logging.error(
            f"The specified user ID {user_id} or properties are invalid. Detail: {e}"
        )
        return jsonify({"error": f"Invalid specified user ID."}), 400

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


def upload_photo(photo, user_id):
    extension = Image.open(photo).format

    if not extension:
        return jsonify({"error": "Unrecognized image file extension"}), 400

    filename = f"{hash([user_id, photo.filename])}.{extension.lower()}"
    blob = bucket.blob(blob_name=filename)
    blob.upload_from_file(photo.stream, content_type=photo.content_type)
    blob.make_public()
    return blob.public_url


def openai_streaming(query):
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[    {"role": "system", "content": "You are a helpful assistant. Please structure your response using Markdown with headings, paragraphs, and bullet points where appropriate."},
        {
            "role": "user",
            "content": query
        }],
        stream=True,
    )
    for chunk in stream:
        if chunk.choices[0].delta.content is not None:
            yield chunk.choices[0].delta.content


@app.route("/consult", methods=["POST"])
@require_fields(["chat-input"], source_type="form")
def consult(data):
    query = data.get("chat-input")
    if not query:
        return "Query parameter is required.", 400
    return Response(openai_streaming(query), content_type="text/plain")


def removeUnverifiedUsers():
    print("This job runs every 24 hours.")


if __name__ == "__main__":

    app.run(debug=True)
