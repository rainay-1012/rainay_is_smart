import io
import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
import pandas as pd
from dotenv import load_dotenv
from firebase_admin import auth
from firebase_admin._user_mgt import UserRecord
from flask import (
    Flask,
    Response,
    abort,
    g,
    json,
    jsonify,
    redirect,
    render_template,
    request,
    url_for,
)
from flask.helpers import send_file
from flask_mail import Message
from google.cloud.exceptions import GoogleCloudError
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.datastructures.file_storage import FileStorage
from werkzeug.exceptions import HTTPException

from database import (
    TABLES_METADATA,
    Category,
    Company,
    Item,
    Package,
    Position,
    Token,
    User,
    Vendor,
    db,
    init_db,
)
from utils import (
    ResourceNotFoundException,
    UserNotFoundException,
    check_token,
    get_bearer_token,
    init_logger,
    init_mail,
    mail,
    on_ajax_render,
    openai_response,
    remove_photo,
    require_fields,
    upload_photo,
)

load_dotenv()

app = Flask(__name__, template_folder="dist", static_folder="dist/static")
init_logger(app)
init_mail(app)
init_db(app)


app.config["SERVER_NAME"] = (
    os.environ["PROD_SERVER_NAME"]
    if os.environ["PRODUCTION"] == "1"
    else "localhost:5000"
)
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]


@app.errorhandler(ResourceNotFoundException)
def handle_resource_not_found(e):
    app.logger.exception(f"{e.name} not found: {e.message}")

    return jsonify(
        {
            "code": e.status_code,
            "name": e.name,
            "message": e.message,
            "content": render_template(
                "error.html",
                error_start=str(e.status_code)[0],
                error_end=str(e.status_code)[2],
                error_title=f"{e.name} Not Found",
                error_description=e.message,
                redirect_url=url_for("index", _external=True),
            ),
        }
    ), e.status_code


@app.errorhandler(HTTPException)
def handle_http_exception(e):
    app.logger.exception(e)
    code = e.code
    description = (
        e.description
        if isinstance(e.description, dict)
        else {
            "name": "Page Not Found",
            "message": e.description
            if isinstance(e.description, str)
            else "An HTTP error occurred.",
        }
    )

    return render_template(
        "error.html",
        error_start=str(code)[0],
        error_end=str(code)[2],
        error_title=description.get("name"),
        error_description=description.get("message"),
        style=True,
        redirect_url=url_for("index", _external=True),
    ), e.code


@app.errorhandler(SQLAlchemyError)
def handle_database_exception(e):
    db.session.rollback()
    app.logger.exception(f"Database error occurred: {str(e)}")
    return handle_generic_exception(e, log=False)


@app.errorhandler(Exception)
def handle_generic_exception(e, log=True):
    if log:
        app.logger.exception(f"Unexpected error occurred: {str(e)}")
    code = 500
    description = {
        "name": "Internal Server Error",
        "message": "An unexpected error occurred. Please try again later.",
    }

    return render_template(
        "error.html",
        error_start=str(code)[0],
        error_end=str(code)[2],
        error_title=description.get("name"),
        error_description=description.get("message"),
        style=True,
        redirect_url=url_for("index", _external=True),
    ), code


@app.route("/")
@on_ajax_render("index.html")
def index():
    return render_template("index.html")


@app.route("/login")
@on_ajax_render("login.html")
def login():
    return render_template("index.html", redirect_url="/login")


@app.route("/login_redirect", methods=["POST"])
@check_token()
def login_redirect():
    uid = g.user["uid"]

    user = db.session.get(User, uid)

    if user is None:
        raise UserNotFoundException()

    position = user.token.position

    if position == Position.manager or position == Position.executive:
        return jsonify(
            {
                "success": True,
                "message": "Redirecting to dashboard",
                "redirect": url_for("dashboard"),
            }
        )
    if position == Position.admin:
        return jsonify(
            {
                "success": True,
                "message": "Redirecting to developer dashboard",
                "redirect": url_for("developer_dashboard"),
            }
        )

    raise ResourceNotFoundException(
        name="Position", message="Invalid position assigned to the user."
    )


@app.route("/register")
@on_ajax_render("register.html")
def register():
    return render_template("index.html", redirect_url="/register")


@app.route("/verify_token")
def verify_token():
    token_id = get_bearer_token(request)
    token = db.session.get(Token, token_id)

    if not token or token.user:
        return (
            jsonify(
                {
                    "name": "auth/invalid-token",
                    "message": "The provided token is invalid.",
                },
            ),
            400,
        )

    return (
        jsonify({"name": "Valid token", "message": "Token is verified and valid"}),
        201,
    )


@app.route("/create_user", methods=["POST"])
@require_fields(["token"])
def create_user(data):
    try:
        token_id = data["token"]
        token = db.session.get(Token, token_id)

        if not token or token.user:
            raise ResourceNotFoundException(
                name="Token", message="Require valid token from registered company"
            )

        data = request.get_json()
        id_token = data.get("id_token")

        if id_token:
            decoded_token = auth.verify_id_token(id_token)
            user = auth.get_user(decoded_token["uid"])
            auth.update_user(user.uid, email_verified=True)

            db_user = User(id=decoded_token["uid"], token_id=token_id)
            db.session.add(db_user)
            db.session.commit()
            app.logger.info(f"User created with ID: {user.uid}")
            return (
                jsonify(
                    {"message": "User created successfully", "name": "success register"}
                ),
                201,
            )

        email = data.get("email")
        password = data.get("password")

        if not (email and password):
            raise ValueError(
                {
                    "name": "Missing required fields",
                    "message": "Required email and password/ user id token",
                }
            )

        try:
            user = auth.get_user_by_email(email)
            if not user.email_verified:
                auth.delete_user(user.uid)
        except auth.UserNotFoundError:
            pass

        user: UserRecord = auth.create_user(
            email=email,
            password=password,
            email_verified=False,
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

        app.logger.info(f"User created with ID: {user.uid}")

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

    except auth.EmailAlreadyExistsError:
        app.logger.exception(f"{email} is already in use.")
        return jsonify({"error": "Email already in use"}), 400


@app.route("/get_user_role")
@check_token()
def get_user_role():
    if g.user.get("role"):
        role = g.user["role"]
    else:
        user = db.session.get(User, g.user["uid"])

        if user is None:
            app.logger.error(f"User not found with UID: {g.user['uid']}")
            role = None
        else:
            role = user.token.user if user.token else None

    if not role:
        return jsonify({"error": "Role not found"}), 404

    return jsonify({"role": role}), 200


@app.route("/get_user_info")
@check_token()
def get_user_info():
    try:
        user_id = g.user["uid"]
        user_record: UserRecord = auth.get_user(user_id)
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({"error": "No user is specified"}), 400

        return (
            jsonify(
                {
                    "user": {
                        "id": user_id,
                        "name": user.fullname,
                        "username": user_record.display_name,
                        "photo": user_record.photo_url,
                        "phoneNo": user_record.phone_number,
                        "date": user.join_date,
                        "email": user_record.email,
                        "position": user.token.position.name,
                        "company": user.token.company.name,
                    },
                },
            ),
            201,
        )

    except (ValueError, auth.UserNotFoundError) as e:
        app.logger.exception(
            f"The specified user ID {user_id} or properties are invalid. Detail: {e}",
        )
        return jsonify({"error": "Invalid specified user ID."}), 400

    except Exception as e:
        app.logger.exception(f"An error occurred: {e!s}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/update_user", methods=["POST"])
@check_token()
def update_user():
    try:
        user_id = g.user["uid"]
        user = db.session.get(User, user_id)
        user_record: UserRecord = auth.get_user(user_id)

        if not user:
            return jsonify({"error": "No user is specified"}), 400

        photo: Optional[FileStorage] = request.files.get("file")

        if photo and photo.filename:
            remove_photo(user_record.photo_url)
            photo_url = upload_photo(photo, user_id)
            auth.update_user(
                uid=user_id,
                photo_url=photo_url,
            )
            return (
                jsonify(
                    {
                        "message": "User photo successfully updated.",
                        "photo": photo_url,
                    }
                ),
                201,
            )
        else:
            app.logger.debug(request.form)
            name = request.form.get("name")
            phone_number = request.form.get("phoneNo")
            username = request.form.get("username")
            if not (name and username and phone_number):
                return jsonify(
                    {"error": "All fields (name, username, phoneNo) are required."}
                ), 400

            auth.update_user(
                uid=user_id,
                display_name=username,
                phone_number=phone_number,
            )
            user.fullname = name
            db.session.commit()
            return (
                jsonify(
                    {
                        "message": "User successfully updated.",
                        "user_id": user_id,
                    }
                ),
                201,
            )

    except GoogleCloudError as e:
        app.logger.exception(f"Google cloud error: {e}")
        return jsonify({"error": "An error occurred while uploading the file."}), 500

    except (ValueError, auth.UserNotFoundError) as e:
        app.logger.exception(
            f"The specified user ID {user_id} or properties are invalid. Detail: {e}",
        )
        return jsonify({"error": "Invalid specified user ID."}), 400

    except Exception as e:
        app.logger.exception(f"An error occurred: {e!s}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/is_email_verified")
def is_email_verified():
    email = request.args["email"]
    return {"verified": auth.get_user_by_email(email).email_verified}, 200


@app.route("/verify_email")
@require_fields(["token"], source_type="args")
def verify_email(data):
    try:
        token = data["token"]
        decoded_token = jwt.decode(
            token,
            app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )

        user = auth.get_user(decoded_token["uid"])
        auth.update_user(user.uid, email_verified=True)

        db_user = User(id=decoded_token["uid"], token_id=decoded_token["token"])  # type: ignore
        db.session.add(db_user)
        db.session.commit()

        return redirect(url_for("email_verified"))

    except auth.UserNotFoundError:
        abort(
            403,
            description={
                "title": "Email No Longer Exists",
                "body": "The email is either expired or check your inbox for the latest verification email.",
            },
        )

    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.exception(f"Database error: {e!s}")
        abort(
            500,
            description={
                "title": "Something Went Wrong",
                "body": "We encountered an issue while processing your request. Please try again later.",
            },
        )

    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        abort(
            400,
            description={
                "title": "Token Expired or Invalid",
                "body": "The token is either expired or invalid. Please request a new verification email.",
            },
        )

    except Exception as e:
        app.logger.exception(f"An unexpected error occurred: {e!s}")
        abort(
            500,
            description={
                "title": "Unexpected Error",
                "body": "An unexpected error occurred. Please try again later.",
            },
        )


@app.route("/email_verified")
def email_verified():
    return render_template("email_verified.html")


@app.route("/developer_dashboard")
@on_ajax_render("dev_dashboard.html")
def developer_dashboard():
    return render_template("index.html", redirect_url=url_for("developer_dashboard"))


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

        company = Company(name=name, address=address, email=email, package=package)
        db.session.add(company)
        db.session.commit()

        m_token_count, e_token_count = package.value
        m_tokens = [
            Token(position=Position.manager, company_id=company.id)
            for _ in range(m_token_count)
        ]  # type: ignore
        e_tokens = [
            Token(position=Position.executive, company_id=company.id)
            for _ in range(e_token_count)
        ]  # type: ignore

        db.session.add_all(m_tokens)
        db.session.add_all(e_tokens)
        db.session.commit()

        download_token_url = url_for("download_token", id=company.id, _external=True)
        print(f"Download token url: {download_token_url}")

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
                token_link=download_token_url,
            ),
        )
        mail.send(msg)

        return (
            jsonify(
                {
                    "message": "Company created successfully",
                    "company_name": company.name,
                },
            ),
            201,
        )

    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.exception(f"Database error occurred: {e!s}")
        return jsonify({"error": "Database error occurred."}), 500

    except Exception as e:
        app.logger.exception(f"An error occurred: {e!s}")
        return jsonify({"error": "An unexpected error occurred."}), 500


@app.route("/get_company_data", methods=["GET"])
@check_token(Position.admin)
def get_company_data():
    companies = db.session.query(Company).filter(Company.id != "test").all()

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
    tokens = db.session.query(Token).join(Company).filter(Company.id != "test").all()
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
        csv_buffer,
        as_attachment=True,
        download_name="tokens.csv",
        mimetype="text/csv",
    )


@app.route("/dashboard")
@on_ajax_render("dashboard.html")
def dashboard():
    return render_template("index.html", redirect_url="/dashboard")


@app.route("/dashboard/procurement")
@on_ajax_render("procurement.html")
def procurement():
    return render_template("index.html", redirect_url="/dashboard/procurement")


@app.route("/dashboard/profile")
@on_ajax_render("profile.html")
def profile():
    return render_template("index.html", redirect_url="/dashboard/profile")


@app.route("/dashboard/item")
@on_ajax_render("item.html")
def item():
    return render_template("index.html", redirect_url="/dashboard/item")


@app.route("/dashboard/vendor")
@on_ajax_render("vendor.html")
def vendor():
    return render_template("index.html", redirect_url="/dashboard/vendor")


@app.route("/dashboard/purchase")
@on_ajax_render("purchase.html")
def purchase():
    return render_template("purchase.html", redirect_url="/dashboard/purchase")


# user
@app.route("/get_user_data", methods=["GET"])
@check_token(Position.executive)
def get_user_data():
    users = User.query.filter(User.id != "test").all()

    data = []

    for user in users:
        user_record: UserRecord = auth.get_user(user.id)

        data.append(
            {
                "id": user.id,
                "name": user.fullname,
                "username": user_record.display_name,
                "photo": user_record.photo_url,
                "phoneNo": user_record.phone_number,
                "date": user.join_date,
                "email": user_record.email,
                "position": user.token.position.name,
                "company": user.token.company.name,
            },
        )

    app.logger.debug(data)

    return (
        jsonify(data),
        201,
    )


@app.route("/delete_user/<user_id>", methods=["DELETE"])
@check_token(Position.executive)
def delete_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    remove_photo(user.photo)

    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error deleting user", "error": str(e)}), 500


@app.route("/upsert_user", methods=["POST"])
@check_token(Position.executive)
@require_fields(["id", "name", "username", "email", "phoneNo"], source_type="form")
def upsert_user(data):
    try:
        current_user = db.session.get(User, g.user["uid"])
        if not current_user:
            return jsonify({"message": "User not found"}), 404

        user_id = data.get("id")
        name = data.get("name")
        username = data.get("username")
        email = data.get("email")
        phone_no = data.get("phoneNo")

        # Ensure the user ID exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Update user details
        user.name = name
        user.username = username
        user.email = email
        user.phone_no = phone_no

        db.session.commit()

        # Handle photo upload
        photo_file = request.files.get("photo")
        if photo_file:
            remove_photo(user.photo)  # Remove the old photo
            photo_path = upload_photo(photo_file, user.id)  # Upload the new photo
            user.photo = photo_path
            db.session.commit()

        return jsonify({"message": "User updated successfully!"}), 200

    except Exception as e:
        db.session.rollback()
        app.logger.error(e)
        return jsonify({"error": str(e)}), 400


@app.route("/get_item_data", methods=["GET"])
@check_token(Position.executive)
def get_item_data():
    user = db.session.get(User, g.user["uid"])

    if not user:
        return jsonify({"message": "User not found"}), 404

    company_id = user.token.company_id
    items = Item.query.filter_by(company_id=company_id).all()

    data = [
        {
            "id": item.id,
            "name": item.name,
            "photo": item.photo,
            "last_update": item.last_update,
            "categories": [category.name for category in item.categories],
        }
        for item in items
    ]
    return jsonify({"data": data})


@app.route("/delete_item/<item_id>", methods=["DELETE"])
@check_token(Position.executive)
def delete_item(item_id):
    item = db.session.get(Item, item_id)

    if not item:
        return jsonify({"message": "Item not found"}), 404

    remove_photo(item.photo)

    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": "Item deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error deleting item", "error": str(e)}), 500


@app.route("/upsert_item", methods=["POST"])
@check_token(Position.executive)
@require_fields(["id", "name", "categories"], source_type="form")
def upsert_item(data):
    try:
        user = db.session.get(User, g.user["uid"])
        if not user:
            return jsonify({"message": "User not found"}), 404

        company_id = user.token.company_id
        item_id = data["id"]
        name = data["name"]
        categories = data["categories"]
        categories = json.loads(categories) if categories else []

        category_objs = []
        for category_name in categories:
            category = Category.query.filter_by(name=category_name).first()
            if not category:
                category = Category(
                    name=category_name,
                    company_id=company_id,
                )
                db.session.add(category)
            category_objs.append(category)

        if item_id:
            item = Item.query.get(item_id)
            if not item:
                return jsonify({"error": "Item not found"}), 404

            remove_photo(item.photo)
            item.name = name
            item.last_update = datetime.utcnow()
            item.categories = category_objs
        else:
            item = Item(
                name=name,
                categories=category_objs,
                company_id=company_id,
            )
            db.session.add(item)

        db.session.commit()

        photo_file = request.files.get("photo")
        if photo_file:
            photo_path = upload_photo(photo_file, item.id)
            item.photo = photo_path
            db.session.commit()

        return jsonify({"message": "Item managed successfully!"}), (
            201 if not item_id else 200
        )

    except Exception as e:
        db.session.rollback()
        app.logger.error(e)
        return jsonify({"error": str(e)}), 400


@app.route("/get_vendor_data", methods=["GET"])
@check_token(Position.executive)
def get_vendor_data():
    user = db.session.get(User, g.user["uid"])
    if not user:
        return jsonify({"message": "User not found"}), 404

    company_id = user.token.company_id if user.token else None
    if not company_id:
        return jsonify({"message": "User does not belong to a company"}), 400

    vendors = Vendor.query.filter_by(company_id=company_id).all()

    data = [
        {
            "id": vendor.id,
            "name": vendor.name,
            "categories": [category.name for category in vendor.categories],
            "email": vendor.email,
            "address": vendor.address,
            "gred": vendor.gred,
            "approved": vendor.approved,
        }
        for vendor in vendors
    ]
    return jsonify({"data": data})


@app.route("/upsert_vendor", methods=["POST"])
@check_token(Position.executive)
@require_fields(["id", "name", "categories", "email", "address"], source_type="form")
def upsert_vendor(data):
    try:
        user = db.session.get(User, g.user["uid"])
        if not user:
            return jsonify({"message": "User not found"}), 404

        company_id = user.token.company_id
        vendor_id = data.get("id")
        name = data.get("name")
        categories = json.loads(data.get("categories", "[]"))
        email = data.get("email")
        address = data.get("address")

        category_objs = []
        for category_name in categories:
            category = Category.query.filter_by(name=category_name).first()
            if not category:
                category = Category(name=category_name, company_id=company_id)
                db.session.add(category)
            category_objs.append(category)

        if vendor_id:
            vendor = db.session.get(Vendor, vendor_id)
            if not vendor:
                return jsonify({"error": "Vendor not found"}), 404

            vendor.name = name
            vendor.email = email
            vendor.address = address
            vendor.categories = category_objs
        else:
            vendor = Vendor(
                name=name,
                email=email,
                address=address,
                categories=category_objs,
                company_id=company_id,
            )
            db.session.add(vendor)

        db.session.commit()
        return jsonify({"message": "Vendor managed successfully!"}), (
            201 if not vendor_id else 200
        )

    except Exception as e:
        db.session.rollback()
        app.logger.error(e)
        return jsonify({"error": str(e)}), 400


@app.route("/delete_vendor/<vendor_id>", methods=["DELETE"])
@check_token(Position.manager)
def delete_vendor(vendor_id):
    vendor = db.session.get(Vendor, vendor_id)

    if not vendor:
        return jsonify({"message": "Vendor not found"}), 404

    try:
        db.session.delete(vendor)
        db.session.commit()
        return jsonify({"message": "Vendor deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error deleting vendor", "error": str(e)}), 500


@app.route("/approve_vendor/<vendor_id>", methods=["POST"])
@check_token(Position.manager)
def approve_vendor(vendor_id):
    vendor = db.session.get(Vendor, vendor_id)

    if not vendor:
        return jsonify({"message": "Vendor not found"}), 404

    try:
        vendor.approved = True
        db.session.commit()
        return jsonify({"message": "Vendor approved successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error approving vendor", "error": str(e)}), 500


@app.route("/dashboard/vendor")
@check_token(Position.executive)
def vendor_dashboard():
    return render_template("vendor.html")


@app.route("/dashboard/report")
@on_ajax_render("report.html")
def report():
    return render_template("index.html", redirect_url="/dashboard/report")


@app.route("/get_metadata")
@check_token(Position.manager)
def get_metadata():
    return jsonify(TABLES_METADATA), 200


@app.route("/get_data_settings", methods=["POST"])
@check_token(Position.manager)
def get_data_settings():
    try:
        data: dict = request.get_json()
        info = {}

        for table, columns in data.items():
            info[table] = {
                "description": TABLES_METADATA[table]["description"],
                "columns": {},
                "relationships": {},
            }

            for col in columns:
                column_info = TABLES_METADATA[table]["columns"].get(col)
                if column_info:
                    info[table]["columns"][col] = column_info

            if len(data.keys()) > 1:
                for other_table in data:
                    if other_table != table:
                        relationship_description = TABLES_METADATA[table][
                            "relationships"
                        ].get(other_table)
                        if relationship_description:
                            info[table]["relationships"][other_table] = (
                                relationship_description
                            )
        app.logger.debug("hi")
        response = "".join(
            str(part)
            for part in openai_response(
                json.dumps(info, indent=2),
                system_content="""You are an advanced data assistant designed to process structured data and generate visualizations using the Echarts library. Based on the provided data structure, generate a comprehensive list of possible charts, including their titles and Echarts configuration options (option object, strictly in json). Ensure the configurations are appropriately tailored to the data's format and content. If no charts can be generated due to the nature of the data, return an empty list.""",
                streaming=False,
            )
        )

        app.logger.debug(response)

    except Exception as e:
        app.logger.exception(e)

    return jsonify(response), 200


@app.route("/consult", methods=["POST"])
@require_fields(["chat-input"], source_type="form")
def consult(data):
    query = data.get("chat-input")
    if not query:
        return "Query parameter is required.", 400

    streaming = data.get("streaming", "true").lower() == "true"
    if streaming:
        return Response(
            (chunk for chunk in openai_response(query, streaming=True) if chunk),
            content_type="text/plain",
        )

    response = "".join(chunk or "" for chunk in openai_response(query, streaming=False))
    return Response(response, content_type="text/plain")


def removeUnverifiedUsers():
    print("This job runs every 24 hours.")


if __name__ == "__main__":
    app.run(debug=True)
