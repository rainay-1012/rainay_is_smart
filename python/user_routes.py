from datetime import datetime, timedelta
from typing import Optional

import jwt
from database import Position
from error_routes import render_error_template
from firebase_admin import auth
from firebase_admin.auth import UserRecord
from flask import (
    Blueprint,
    abort,
    g,
    json,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)
from flask import current_app as app
from flask_mail import Message
from flask_pydantic import validate
from pydantic import EmailStr
from utils import (
    check_token,
    emit_data_change,
    mail,
    on_ajax_render,
    remove_photo,
    upload_photo,
)
from werkzeug.datastructures import FileStorage

from python.response import DataResponse, InvalidUserException, Response
from python.schema import UpdateUserData, UserRegistrationData, VerifyEmailQuery

user_routes = Blueprint("user_routes", __name__)


def extract_user_info(user: auth.UserRecord):
    return {
        "id": user.uid,
        "name": user.custom_claims.get("fullname") if user.custom_claims else None,
        "username": user.display_name,
        "role": user.custom_claims.get("role") if user.custom_claims else None,
        "phoneNo": user.phone_number,
        "date": datetime.fromtimestamp(
            user.user_metadata.creation_timestamp / 1000
        ).strftime("%Y-%m-%d %H:%M:%S.%f")
        if user.user_metadata.creation_timestamp
        else None,
        "photo": user.photo_url,
        "email": user.email,
    }


@user_routes.route("/account")
@on_ajax_render("account.html")
def login():
    return render_template("index.html", redirect_url="/account")


@user_routes.route("/login_redirect", methods=["POST"])
@check_token()
def login_redirect():
    uid = g.user["uid"]

    user: UserRecord = auth.get_user(uid)

    if not user.custom_claims:
        raise InvalidUserException(
            user_message="We encountered an issue processing your request. Please contact support for assistance.",
            server_message=f"User with ID {uid} is missing required claims for role-based redirection.",
        )

    position = user.custom_claims.get("role")

    if Position[position]:
        return Response(
            code="auth/success-redirect",
            message="Redirecting to dashboard.",
            redirect=url_for("dashboard"),
        ).to_response()

    raise InvalidUserException(
        user_message="We encountered an issue processing your request. Please contact support for assistance.",
        server_message=f"User with ID {uid} has an invalid role. Valid roles are: {list(Position.__members__.keys())}.",
        status_code=403,
    )


@user_routes.route("/create_social_user")
@check_token()
def create_google_user():
    user_record = auth.update_user(
        g.user["uid"],
        email_verified=True,
        custom_claims={"role": Position.executive.name},
    )
    emit_data_change(
        g.user["uid"],
        "add",
        None,
        "users",
        json.dumps(extract_user_info(user_record)),
    )

    return Response(
        code="auth/social-user-created",
        message="Your account has been successfully created. Redirecting to your dashboard",
        status_code=201,
    ).to_response()


@user_routes.route("/create_email_user", methods=["POST"])
@validate()
def create_email_user(body: UserRegistrationData):
    try:
        user = auth.get_user_by_email(body.email)
        if user:
            provider_ids = [provider.provider_id for provider in user.provider_data]

            if "password" not in provider_ids:
                return Response(
                    code="auth/invalid-provider",
                    message="Please log in to your account with the registered provider and update your information there",
                    status_code=400,
                ).to_response()

            else:
                if not user.email_verified:
                    auth.delete_user(user.uid)

    except auth.UserNotFoundError:
        pass

    user: UserRecord = auth.create_user(
        email=body.email,
        password=body.password,
        email_verified=False,
        display_name=body.username,
        phone_number=body.phone,
    )

    auth.set_custom_user_claims(user.uid, {"fullname": body.fullname})

    signed_token = jwt.encode(
        dict(
            uid=user.uid,
            exp=datetime.now() + timedelta(hours=1),
        ),
        app.config["SECRET_KEY"],
        algorithm="HS256",
    )

    app.logger.info(f"User created with ID: {user.uid}")

    link = url_for("user_routes.verify_email", token=signed_token, _external=True)
    app.logger.debug(link)

    msg = Message(
        "Vendosync email verification",
        recipients=[body.email],
        html=render_template(
            "verification_email.html",
            email=body.email,
            verify_link=link,
        ),
    )

    mail.send(msg)

    return Response(
        code="auth/email-pending-verify",
        message="User created successfully. Please check your inbox for verification email.",
        status_code=201,
    ).to_response()


@user_routes.route("/get_users_data")
@check_token(Position.admin)
def get_users_data():
    app.logger.debug(f"{g.user['email']} | Request users data")
    users = []
    page = auth.list_users()

    while page:
        for user in page.users:
            user: UserRecord

            if user.email_verified:
                user_data = extract_user_info(user)

            users.append(user_data)

        page = page.get_next_page()

    return DataResponse(data=users).to_response()


@user_routes.route("/update_user", methods=["POST"])
@check_token()
@validate()
def update_user(form: UpdateUserData):
    request_user_role = g.user["role"]
    request_user_id = g.user["uid"]
    target_uid = form.uid

    if request_user_id != target_uid and request_user_role != "admin":
        abort(403)

    user_record: UserRecord = auth.get_user(target_uid)
    existing_claims = user_record.custom_claims or {}

    if form.role and request_user_role == "admin":
        existing_claims["role"] = form.role

    if form.name:
        existing_claims["fullname"] = form.name

    auth.set_custom_user_claims(target_uid, existing_claims)

    updates = {}

    if form.username:
        updates["display_name"] = form.username
    if form.phoneNo:
        updates["phone_number"] = form.phoneNo

    photo: Optional[FileStorage] = request.files.get("image")
    app.logger.debug(photo)
    if photo and photo.filename:
        try:
            remove_photo(user_record.photo_url)
        except Exception:
            app.logger.debug("Photo url not found. Skipping delete...")
            pass
        photo_url = upload_photo(photo, target_uid)
        updates["photo_url"] = photo_url

    if updates:
        user_record = auth.update_user(target_uid, **updates)

    if request_user_id != target_uid:
        auth.revoke_refresh_tokens(target_uid)

    emit_data_change(
        g.user["uid"],
        "modify",
        None,
        "users",
        json.dumps(extract_user_info(user_record)),
    )

    return jsonify(
        {"code": "auth/update-user", "message": "User has been successfully updated."}
    ), 200


@user_routes.route("/is_email_verified/<email>", methods=["GET"])
def is_email_verified(email: EmailStr):
    user: UserRecord = auth.get_user_by_email(email)
    code = "auth/verified-email"
    message = "The provided email is verified."
    status_code = 200

    if "password" not in [provider.provider_id for provider in user.provider_data]:
        code = "auth/invalid-provider"
        message = "The provided email is registered with other provider."
        status_code = 400

    if not user.email_verified:
        code = "auth/unverfied-email"
        message = "Please verify your email before proceed."
        status_code = 400

    return Response(
        code=code,
        message=message,
        status_code=status_code,
    ).to_response()


@user_routes.route("/delete_user/<uid>", methods=["DELETE"])
@check_token(Position.admin)
def delete_vendor(uid):
    auth.delete_user(uid)

    emit_data_change(g.user["uid"], "delete", None, "users", json.dumps({"id": uid}))
    return jsonify(
        {"code": "crud/delete", "message": "User has been deleted successfully."}
    ), 200


@user_routes.route("/verify_email")
@validate()
def verify_email(query: VerifyEmailQuery):
    try:
        token = query.token
        decoded_token = jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )

        user = auth.get_user(decoded_token["uid"])
        user_record: UserRecord = auth.update_user(
            user.uid,
            email_verified=True,
            custom_claims={"role": Position.executive.name},
        )

        emit_data_change(
            user.uid,
            "modify",
            None,
            "users",
            json.dumps(extract_user_info(user_record)),
        )

        return redirect(url_for("user_routes.email_verified"))

    except auth.UserNotFoundError:
        return render_error_template(
            403,
            "Email No Longer Exists!",
            "The email is either expired or check your inbox for the latest verification email.",
        )

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return render_error_template(
            500,
            "Token Expired or Invalid!",
            "The token is either expired or invalid. Please request a new verification email.",
        )

    except Exception as e:
        app.logger.exception(
            f"An unexpected error occurred during email verification: {e!s}"
        )
        return render_error_template(
            500,
            "Unexpected Error!",
            "An unexpected error occurred. Please try again later.",
        )


@user_routes.route("/email_verified")
def email_verified():
    return render_template("email_verified.html")
