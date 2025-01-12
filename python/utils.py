import logging
import os
from enum import Enum
from functools import wraps
from typing import Optional
from urllib.parse import urlparse

import bleach
import firebase_admin
from database import (
    Position,
)
from dotenv import load_dotenv
from firebase_admin import auth, credentials, storage
from flask import current_app as app
from flask import g, json, jsonify, request
from flask.app import Flask
from flask.helpers import abort
from flask.templating import render_template
from flask_mail import Mail
from flask_socketio import emit
from openai import OpenAI, Stream
from openai.types.chat import ChatCompletion
from PIL import Image
from werkzeug.datastructures import MultiDict

load_dotenv()

mail = Mail()

cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
firebase_admin.initialize_app(cred, {"storageBucket": os.environ["STORAGE_URL"]})
client = OpenAI()

bucket = storage.bucket()


def get_bearer_token():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    return auth_header.split(" ", 1)[1]


def check_token(required_role: Optional[Position] = None):
    def decorator(f):
        @wraps(f)
        def wrap(*args, **kwargs):
            try:
                token = get_bearer_token()

                if not token:
                    abort(403)

                user = auth.verify_id_token(token, clock_skew_seconds=10)
            except Exception as e:
                app.logger.exception(f"Error verifying token: {e}")
                abort(403)
            else:
                g.user = user
                if required_role:
                    if user.get("role"):
                        if Position[user.get("role")].value < required_role.value:
                            abort(403)

            return f(*args, **kwargs)

        return wrap

    return decorator


def validate_data(required_fields, data):
    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return jsonify(
            {
                "code": "validate/missing-data",
                "message": f"Missing field(s): {', '.join(missing_fields)}",
            },
        ), 400

    sanitized_data = {}

    for key in data.keys():
        if isinstance(data, MultiDict):
            values = data.getlist(key)
        else:
            values = [data[key]]

        sanitized_values = []
        for value in values:
            if isinstance(value, list):
                sanitized_values.append(
                    [
                        bleach.clean(
                            str(item),
                            strip=True,
                            tags=[],
                            attributes={},
                            strip_comments=True,
                        )
                        for item in value
                    ]
                )
            else:
                sanitized_values.append(
                    bleach.clean(
                        str(value),
                        strip=True,
                        tags=[],
                        attributes={},
                        strip_comments=True,
                    )
                )

        sanitized_data[key] = (
            sanitized_values[0] if len(sanitized_values) == 1 else sanitized_values
        )

    return sanitized_data


def require_fields(required_fields, source_type="json"):
    def decorator(f):
        @wraps(f)
        def wrap(*args, **kwargs):
            if source_type == "json":
                data = request.get_json() or {}
            elif source_type == "form":
                data = request.form
            elif source_type == "args":
                data = request.args

            sanitized_data = validate_data(required_fields, data)

            kwargs["data"] = sanitized_data
            return f(*args, **kwargs)

        return wrap

    return decorator


def on_ajax_render(template_name):
    def decorator(f):
        @wraps(f)
        def wrapped_function(*args, **kwargs):
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return render_template(
                    "index.html", main_content=render_template(template_name)
                )
            return f(*args, **kwargs)

        return wrapped_function

    return decorator


def init_logger(app: Flask):
    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[1;31m",  # Bold Red
        "RESET": "\033[0m",  # Reset
    }

    class ColorFormatter(logging.Formatter):
        def format(self, record):
            color = COLORS.get(record.levelname, COLORS["RESET"])
            reset = COLORS["RESET"]
            record.asctime = f"{color}{self.formatTime(record, self.datefmt)}{reset}"
            record.levelname = f"{color}{record.levelname}{reset}"
            record.msg = f"{color}{record.msg}{reset}"
            return f"{record.asctime} - {record.levelname} - {record.msg}"

    # Access the built-in logger
    logger = app.logger

    # Clear existing handlers
    logger.handlers.clear()

    # Add a custom handler with color formatting
    handler = logging.StreamHandler()
    handler.setFormatter(
        ColorFormatter(
            "%(asctime)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )
    )
    logger.addHandler(handler)

    # Set the desired logging level
    logger.setLevel(logging.DEBUG)

    app.logger.info("Logger successfully initialized")


def init_mail(app: Flask):
    global mail
    app.config.update(
        {
            "MAIL_SERVER": os.environ.get("MAIL_SERVER", "smtp.gmail.com"),
            "MAIL_PORT": int(os.environ.get("MAIL_PORT", 465)),
            "MAIL_USERNAME": os.environ.get("MAIL_USERNAME"),
            "MAIL_PASSWORD": os.environ.get("MAIL_PASSWORD"),
            "MAIL_USE_TLS": os.environ.get("MAIL_USE_TLS", "False") == "True",
            "MAIL_USE_SSL": os.environ.get("MAIL_USE_SSL", "True") == "True",
            "MAIL_DEFAULT_SENDER": os.environ.get("MAIL_DEFAULT_SENDER"),
            "MAIL_SUPPRESS_SEND": os.environ.get("FLASK_ENV") != "production",
        }
    )
    mail.init_app(app)
    app.logger.info("Mail successfully initialized")


def upload_photo(photo, id):
    extension = Image.open(photo).format

    if not extension:
        raise Exception("Unrecognized image file extension")

    filename = f"{hash((id, photo.filename))}.{extension.lower()}"
    blob = bucket.blob(blob_name=filename)
    photo.stream.seek(0)
    blob.upload_from_file(photo.stream, content_type=photo.content_type)
    blob.make_public()
    app.logger.info(
        f"File {filename} uploaded to Firebase Storage with url {blob.public_url}."
    )
    return blob.public_url


def remove_photo(url):
    parsed_url = urlparse(url)
    file_path = parsed_url.path.split("/")[-1]

    blob = bucket.blob(file_path)

    blob.delete()  # Delete the file from Firebase Storage
    app.logger.info(f"File {file_path} deleted from Firebase Storage.")


def openai_response(query, system_content=None, streaming=True, model="gpt-4o"):
    default_system_content = (
        "You are a helpful assistant for vendor and procurement management system. "
        "Please structure your response using Markdown with headings (no h1 and h2), paragraphs, "
        "and bullet points where appropriate. Don't list the provided data in your response as it causes duplication."
    )

    # Check if the model supports 'system' role
    if model in ["o1", "o1-mini"]:
        # Prepend system instructions to query for models without 'system' role
        prompt = (system_content or default_system_content) + "\n\n" + query
        messages = [{"role": "user", "content": prompt}]
    else:
        # Use 'system' role for models that support it
        messages = [
            {
                "role": "system",
                "content": system_content or default_system_content,
            },
            {"role": "user", "content": query},
        ]

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=streaming,
    )

    if streaming:
        # Stream the response chunk by chunk
        if isinstance(response, Stream):
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
    else:
        # Return the full response when not streaming
        if isinstance(response, ChatCompletion):
            yield response.choices[0].message.content


class SocketDataKey(Enum):
    vendor = Position.executive
    users = Position.admin
    item = Position.executive
    procurement = Position.executive


def emit_data_change(uid, type, data_object=None, dtype=None, data=None):
    if data_object is not None:
        if dtype is None:
            dtype = data_object.__tablename__
        if data is None:
            data = json.dumps(data_object.as_dict())

    if dtype is None or data is None:
        raise ValueError("Either data_object or both dtype and data must be provided.")

    emit(
        "data-change",
        {
            "uid": uid,
            "type": type,
            "dtype": dtype,
            "data": data,
        },
        to=dtype,
        namespace="/data",
    )
