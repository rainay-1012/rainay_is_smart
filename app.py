import logging
import os
from functools import wraps

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth, credentials, storage
from firebase_admin.auth import EmailAlreadyExistsError, UserNotFoundError, UserRecord
from flask import Flask, g, jsonify, redirect, request, url_for
from flask_mail import Mail, Message
from google.cloud.exceptions import GoogleCloudError
from PIL import Image
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.datastructures.file_storage import FileStorage

from database import Company, Position, Token, User, db, init_db

app = Flask(__name__)


def check_token(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return {"message": "No token provided"}, 400

        if not auth_header.startswith("Bearer "):
            return {"message": "Bearer token required"}, 400

        token = auth_header.split(" ", 1)[1]

        try:
            user = auth.verify_id_token(token)
        except Exception as e:
            logging.error(f"Error verifying token: {e}")
            return {"message": "Invalid token provided."}, 400
        else:
            g.user = user
            return f(*args, **kwargs)

    return wrap


@app.route("/")
def home():
    return "Welcome to Flask with APScheduler"


@app.route("/send_email")
def send_email():
    email = request.args.get("email")
    if not email:
        return jsonify({"error": "Missing email."}), 400

    msg = Message(
        "Hello",
        recipients=[email],
        body="hello 123",
    )
    mail.send(msg)
    return "Email sent successfully!"


@app.route("/create_company", methods=["POST"])
def create_company():
    try:
        name = request.args.get("name")
        address = request.args.get("address")

        if not name or not address:
            return jsonify({"error": "Missing name or address"}), 400

        company = Company(name=name, address=address)  # type: ignore

        db.session.add(company)
        db.session.commit()

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


@app.route("/is_user_verified")
def is_user_verified():
    email = request.args.get("email")
    return jsonify({"verified": auth.get_user_by_email(email).email_verified})


@app.route("/create_user", methods=["POST"])
def create_user():
    try:
        email = request.args.get("email")
        password = request.args.get("password")
        token_id = request.args.get("token")
        token = db.session.query(Token).get(token_id)

        if not token or not email or not password:
            return jsonify({"error": "Missing email, password and token"}), 400

        user: UserRecord = auth.create_user(
            email=email, password=password, email_verified=True
        )
        db_user = User(id=user.uid, token=token)  # type: ignore
        db.session.add(db_user)
        db.session.commit()

        logging.info(f"User created with ID: {user.uid}")

        link = auth.generate_email_verification_link(email)

        msg = Message(
            "Vendosync email verification",
            recipients=[email],
            body=link,
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


@app.route("/login")
def login():
    try:
        user_email = request.args.get("email")

        if not user_email:
            return jsonify({"error": "Email are required."}), 400

        user: UserRecord = auth.get_user_by_email(user_email)
        token = db.session.query(Token).where(Token.user_id == user.uid).one()

        if token.position == Position.manager:
            return redirect(url_for("index.html"))

        elif token.position == Position.executive:
            return redirect(url_for("exec"))

        return jsonify({"error": "Invalid email."}), 400

    except (ValueError, UserNotFoundError) as e:
        logging.error(
            f"The specified Email {user_email} or properties are invalid. Detail: {e}"
        )
        return jsonify({"error": "Invalid Email."}), 400

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@check_token
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


@check_token
@app.route("/update_user", methods=["POST"])
def update_user():
    try:
        user_id = g.user["uid"]

        if not user_id:
            return jsonify({"error": "No user is specified"}), 400

        photo: FileStorage | None = request.files.get("file")
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


def removeUnverifiedUsers():
    print("This job runs every 24 hours.")


if __name__ == "__main__":

    load_dotenv()

    app.config["MAIL_SERVER"] = os.environ["MAIL_SERVER"]
    app.config["MAIL_PORT"] = int(os.environ["MAIL_PORT"])
    app.config["MAIL_USERNAME"] = os.environ["MAIL_USERNAME"]
    app.config["MAIL_PASSWORD"] = os.environ["MAIL_PASSWORD"]
    app.config["MAIL_USE_TLS"] = os.environ["MAIL_USE_TLS"] == "True"
    app.config["MAIL_USE_SSL"] = os.environ["MAIL_USE_SSL"] == "True"
    app.config["MAIL_DEFAULT_SENDER"] = os.environ["MAIL_DEFAULT_SENDER"]
    mail = Mail(app)

    init_db(app)

    cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
    firebase_admin.initialize_app(cred, {"storageBucket": os.environ["STORAGE_URL"]})

    bucket = storage.bucket()

    app.run(debug=True, host="0.0.0.0", port=5000)
