from http.client import HTTPException

from database import db
from firebase_admin.auth import (
    EmailAlreadyExistsError,
    PhoneNumberAlreadyExistsError,
    UserNotFoundError,
)
from firebase_admin.exceptions import FirebaseError
from flask import Blueprint, jsonify, render_template, url_for
from flask import current_app as app
from flask_pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from python.response import ExceptionResponse, Response

error_routes = Blueprint("error_routes", __name__)


def render_error_template(code, title, descrption):
    db.session.rollback()
    return render_template(
        "error.html",
        error_start=str(code)[0],
        error_end=str(code)[2],
        error_title=title,
        error_description=descrption,
        style=True,
        redirect_url=url_for("index", _external=True),
    )


@error_routes.app_errorhandler(ValidationError)
def handle_validation_error(e: ValidationError):
    """
    Handles ValidationError exceptions and returns a response in the desired format.
    """
    errors: list[dict[str, str]] = []

    # Process body_params errors
    if e.body_params:
        for error in e.body_params:
            field = error.get("loc", "body")
            message = error.get("msg", "Invalid input")
            errors.append({"field": field, "message": message})

    # Process form_params errors
    if e.form_params:
        for error in e.form_params:
            field = error.get("loc", "form")
            message = error.get("msg", "Invalid input")
            errors.append({"field": field, "message": message})

    # Process path_params errors
    if e.path_params:
        for error in e.path_params:
            field = error.get("loc", "path")
            message = error.get("msg", "Invalid input")
            errors.append({"field": field, "message": message})

    # Process query_params errors
    if e.query_params:
        for error in e.query_params:
            field = error.get("loc", "query")
            message = error.get("msg", "Invalid input")
            errors.append({"field": field, "message": message})

    r = ExceptionResponse(
        code="data/validation-error",
        user_message="Validation failed. Please check your input.",
        server_message=f"Validation errors occurred. Original data: {e.body_params or e.form_params or e.path_params or e.query_params}. Errors: {errors}",
        status_code=400,
        errors=errors,
    )

    app.logger.debug(r)

    return r.to_response()


@error_routes.app_errorhandler(UserNotFoundError)
def handle_user_not_found_exception(e: UserNotFoundError):
    app.logger.debug(f"User not found error occurred: {e.cause}")
    return Response(
        code=e.code,
        message="Account not found. Please check your credentials and try again.",
        status_code=404,
    ).to_response()


@error_routes.app_errorhandler(PhoneNumberAlreadyExistsError)
def handle_phone_number_already_exists_error(e: PhoneNumberAlreadyExistsError):
    """
    Handles PhoneNumberAlreadyExistsError exceptions and returns a user-friendly response.
    """
    app.logger.debug(f"Phone number already exists error occurred: {e}")

    return Response(
        code=e.code,
        message="The provided phone number is already in use. Please use a different phone number.",
        status_code=409,
    ).to_response()


@error_routes.app_errorhandler(EmailAlreadyExistsError)
def handle_email_already_exists_error(e: EmailAlreadyExistsError):
    """
    Handles EmailAlreadyExistsError exceptions and returns a user-friendly response.
    """
    app.logger.debug(f"Email already exists error occurred: {e}")

    return Response(
        code=e.code,
        message="The provided email is already in use. Please use a different email.",
        status_code=409,
    ).to_response()


@error_routes.app_errorhandler(FirebaseError)
def handle_firebase_exception(e: FirebaseError):
    db.session.rollback()
    app.logger.exception(f"Firebase error occurred: {e}")
    return Response(code=e.code, message=str(e), status_code=500).to_response()


@error_routes.app_errorhandler(AssertionError)
def handle_assertion_error(e):
    error_message = (
        "The operation could not be completed. Please check your input and try again."
    )

    if "blank-out primary key column" in str(e):
        error_message = "The item you're trying to update is linked to other records. Please ensure the item is correctly referenced."

    app.logger.exception(f"AssertionError occurred: {str(e)}")

    return jsonify(
        {
            "code": "Operation Failed",
            "message": error_message,
        }
    ), 400


@error_routes.app_errorhandler(SQLAlchemyError)
def handle_database_exception(e):
    db.session.rollback()
    app.logger.exception(f"Database error occurred: {str(e)}")
    return handle_generic_exception(e, log=False)


@error_routes.app_errorhandler(403)
def forbidden_error(error):
    db.session.rollback()
    return jsonify(
        {
            "code": "Access Denied",
            "message": "Your session could not be authenticated. Please log in again to continue.",
        }
    ), 403


@error_routes.app_errorhandler(404)
def page_not_found(e):
    return render_error_template(
        404,
        "Page not found",
        "The requested resource was not found. Please check the URL and try again.",
    )


@error_routes.app_errorhandler(HTTPException)
def handle_http_exception(e):
    db.session.rollback()
    app.logger.exception(f"HTTPException occurred: {e}")

    return jsonify(
        {
            "code": e.name,
            "message": e.message,
        }
    ), e.code


@error_routes.app_errorhandler(ExceptionResponse)
def handle_exception_response(e: ExceptionResponse):
    """
    Handles ExceptionResponse, which is raised for custom exceptions that are also responses.
    """
    app.logger.error(f"Uncaught ExceptionResponse: {str(e)}")
    return e.to_response()


@error_routes.app_errorhandler(Exception)
def handle_generic_exception(e, log=True):
    db.session.rollback()

    if log:
        app.logger.exception(f"Unexpected error occurred: {e}")

    return Response(
        code="server/unexpected-error",
        message="Unexpected error has occurred. Please try again later.",
        status_code=500,
    ).to_response()
