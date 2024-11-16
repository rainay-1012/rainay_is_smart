# import imghdr
import logging
import os
from functools import wraps

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import auth, storage
from firebase_admin.auth import EmailAlreadyExistsError, UserNotFoundError, UserRecord
from flask import Flask, g, jsonify, render_template, request

from database import init_db

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
def index():
    return render_template("index.html")


@app.route("/hello")
def hello():
    return {"message": "hello all"}


#
@app.route("/user/<user_id>")
def user_data(user_id: str):
    print(f"logged in with user id: {user_id}")
    return {"user": f"is this your user id: {user_id}"}


@app.route("/create_user", methods=["POST"])
def create_user():
    try:
        email = request.form.get("email")
        password = request.form.get("password")

        if not email or not password:
            return jsonify({"error": "Missing email or password"}), 400

        user: UserRecord = auth.create_user(
            email=email, password=password, email_verified=False
        )

        link = auth.generate_email_verification_link(email)

        logging.info(f"User created with ID: {user.uid}")

        return (
            jsonify({"message": "User created successfully", "user_id": user.uid}),
            201,
        )

    except EmailAlreadyExistsError:
        logging.error(f"{email} is already in use.")
        return jsonify({"error": "Email already in use"}), 400

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
        return jsonify({"error": f"Invalid specified user ID."}), 400
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred."}), 500


# @check_token
# @app.route("update_user", methods=["POST"])
# def update_user():
#     try:
#         user_id = g.user["uid"]

#         if not user_id:
#             return jsonify({"error": "No user is specified"}), 400

#         photo: FileStorage | None = request.files.get("file")
#         if photo and photo.filename:
#             photo_url = upload_photo(photo, user_id)

#         auth.update_user(
#             uid=user_id,
#             display_name=request.form.get("user_name"),
#             photo_number=request.form.get("phoneNo"),
#             photo_url=photo_url,
#         )
#         logging.info(f"User {user_id} is successfully updated.")

#         return (
#             jsonify({"message": "User successfully updated.", "user_id": user_id}),
#             201,
#         )

#     except GoogleCloudError as e:
#         logging.error(f"Google cloud error: {e}")
#         return jsonify({"error": "An error occurred while uploading the file."}), 500

#     except (ValueError, UserNotFoundError) as e:
#         logging.error(
#             f"The specified user ID {user_id} or properties are invalid. Detail: {e}"
#         )
#         return jsonify({"error": f"Invalid specified user ID."}), 400

#     except Exception as e:
#         logging.error(f"An error occurred: {str(e)}")
#         return jsonify({"error": "An unexpected error occurred."}), 500


# def upload_photo(photo, user_id):
#     # extension = imghdr.what(photo.filename)

#     if not extension:
#         return jsonify({"error": "Unrecognized image file extension"}), 400

#     filename = f"{hash([user_id, datetime.now(), photo.filename])}.{extension}"
#     blob = bucket.blob(blob_name=filename)
#     blob.upload_from_file(photo.stream, content_type=photo.content_type)
#     blob.make_public()
#     return blob.public_url


if __name__ == "__main__":
    # If possible, dont modify things below here, even gpt said so

    load_dotenv()

    init_db(app)

    firebase_admin.initialize_app(None, {"storageBucket": os.environ["STORAGE_URL"]})

    bucket = storage.bucket()

    app.run(debug=True, host="0.0.0.0")
