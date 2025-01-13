from datetime import datetime, timedelta

import jwt
from database import RFQ, Position, ProcurementItem, RFQStatus, Vendor, db, gen
from flask import Blueprint, g, jsonify, render_template, url_for
from flask import current_app as app
from flask_mail import Message
from flask_pydantic import validate
from utils import check_token, emit_data_change, mail

from python.response import DataResponse, Response
from python.schema import AddRFQRequest, PurchaseRequest, RFQEmailParams, RFQSubmission

rfq_routes = Blueprint("rfq_routes", __name__)


@rfq_routes.route("/get_rfq_data", methods=["GET"])
@check_token(Position.executive)
def get_rfq_data():
    app.logger.debug(f"{g.user['email']} | Requesting RFQ data")

    rfqs = (
        db.session.query(
            RFQ.id,
            RFQ.date,
            RFQ.token,
            RFQ.response_time,
            RFQ.procurement_id,
            RFQ.status,
            Vendor.name.label("vendor_name"),
        )
        .join(Vendor, RFQ.vendor_id == Vendor.id)
        .all()
    )

    data = [
        {
            "id": rfq.id,
            "date": rfq.date.isoformat() if rfq.date else None,
            "token": rfq.token,
            "response_time": rfq.response_time.isoformat()
            if rfq.response_time
            else None,
            "status": rfq.status.value,
            "procurement_id": rfq.procurement_id,
            "vendor_name": rfq.vendor_name,
        }
        for rfq in rfqs
    ]

    app.logger.debug(f"{g.user['email']} | Returning RFQ data")
    return DataResponse(data).to_response()


@rfq_routes.route("/add_rfq", methods=["POST"])
@check_token(Position.executive)
@validate()
def add_rfq(body: AddRFQRequest):
    app.logger.debug(f"{g.user['email']} | add rfq with data {body.dict()}")

    procurement_items = ProcurementItem.query.filter(
        ProcurementItem.procurement_id == body.id,
        ProcurementItem.item_id.in_(body.items),
    ).all()

    app.logger.debug(procurement_items)

    rfqs = []
    for vendor_id in body.vendors:
        rfq_id = next(gen)
        rfq_token = jwt.encode(
            {"rfq_id": rfq_id, "exp": datetime.now() + timedelta(weeks=1)},
            app.config["SECRET_KEY"],
            algorithm="HS256",
        )

        rfq = RFQ(
            id=rfq_id,
            procurement_id=body.id,
            vendor_id=vendor_id,
            procurement_items=procurement_items,
            token=rfq_token,
        )
        rfqs.append(rfq)

    db.session.add_all(rfqs)
    db.session.commit()

    app.logger.debug(f"{g.user['email']} | added rfq")

    for rfq in rfqs:
        rfq_link = url_for("rfq_routes.view_rfq", token=rfq.token, _external=True)
        app.logger.debug(f"RFQ Link: {rfq_link}")

        msg = Message(
            "New RFQ Created",
            recipients=[rfq.vendor.email],
            html=render_template(
                "rfq_email.html", rfq_link=rfq_link, vendor=rfq.vendor.name
            ),
        )

        mail.send(msg)

    # Emit socket event for data change
    for rfq in rfqs:
        emit_data_change("cast", "add", rfq)

    return Response(
        code="crud/add",
        message="RFQs have been successfully created, and notification emails have been sent to the respective vendors.",
        status_code=201,
    ).to_response()


@rfq_routes.route("/view_rfq", methods=["GET"])
@validate()
def view_rfq(query: RFQEmailParams):
    token = query.token

    if not token:
        return Response(
            code="error/missing_token", message="Token is missing.", status_code=400
        ).to_response()

    try:
        decoded_token = jwt.decode(
            token, app.config["SECRET_KEY"], algorithms=["HS256"]
        )
        rfq_id = decoded_token.get("rfq_id")

        if not rfq_id:
            return Response(
                code="error/invalid_token", message="Invalid token.", status_code=400
            ).to_response()

        rfq = db.session.get(RFQ, rfq_id)
        if not rfq:
            return Response(
                code="error/not_found", message="RFQ not found.", status_code=404
            ).to_response()

        procurement_items = rfq.procurement_items

        app.logger.debug(procurement_items)

        total = sum(
            float(item.unit_price) * item.quantity if item.unit_price else 0
            for item in procurement_items
        )
        app.logger.debug(procurement_items)

        rfq_data = {
            "rfq_id": rfq.id,
            "date": rfq.date.strftime("%Y-%m-%d %H:%M:%S"),
            "vendor": rfq.vendor.name,
            "status": rfq.status.value,
            "item_list": [
                {
                    "item_id": item.item_id,
                    "item_name": item.item.name,
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price) if item.unit_price else None,
                }
                for item in procurement_items
            ],
            "total": total,
        }
        app.logger.debug(rfq_data)

        return render_template(
            "rfq.html", rfq=rfq_data, token=token, user=not query.internal
        )

    except jwt.ExpiredSignatureError:
        return Response(
            code="error/expired_token", message="Token has expired.", status_code=400
        ).to_response()
    except jwt.InvalidTokenError:
        return Response(
            code="error/invalid_token", message="Invalid token.", status_code=400
        ).to_response()


@rfq_routes.route("/submit_rfq_response", methods=["POST"])
@validate()
def submit_rfq_response(body: RFQSubmission):
    token = body.token

    if not token:
        return jsonify(
            {"code": "error/missing_token", "message": "Token is missing."}
        ), 400

    try:
        # Decode the token
        decoded_token = jwt.decode(
            token, app.config["SECRET_KEY"], algorithms=["HS256"]
        )
        rfq_id = decoded_token.get("rfq_id")

        if not rfq_id:
            return jsonify(
                {"code": "error/invalid_token", "message": "Invalid token."}
            ), 400

        # Fetch the RFQ from the database
        rfq = db.session.get(RFQ, rfq_id)
        if not rfq:
            return jsonify(
                {"code": "error/not_found", "message": "RFQ not found."}
            ), 404

        # Update procurement items with the submitted data
        for submitted_item in body.items:
            # Find the corresponding procurement item in the database
            procurement_item = next(
                (
                    item
                    for item in rfq.procurement_items
                    if item.item_id == submitted_item.item_id
                ),
                None,
            )

            if not procurement_item:
                return jsonify(
                    {
                        "code": "error/invalid_item",
                        "message": f"Item {submitted_item.item_id} not found in RFQ.",
                    }
                ), 400

            # Update the quantity and unit price
            procurement_item.quantity = submitted_item.quantity
            procurement_item.unit_price = submitted_item.unit_price  # type: ignore

        rfq.response_time = datetime.now()
        # Commit changes to the database
        db.session.commit()

        return jsonify(
            {"code": "success", "message": "RFQ response submitted successfully."}
        ), 200

    except jwt.ExpiredSignatureError:
        return jsonify(
            {"code": "error/expired_token", "message": "Token has expired."}
        ), 400
    except jwt.InvalidTokenError:
        return jsonify(
            {"code": "error/invalid_token", "message": "Invalid token."}
        ), 400


@rfq_routes.route("/submit_order", methods=["POST"])
@validate()
def submit_order(body: PurchaseRequest):
    token = body.token

    if not token:
        return jsonify(
            {"code": "error/missing_token", "message": "Token is missing."}
        ), 400

    try:
        decoded_token = jwt.decode(
            token, app.config["SECRET_KEY"], algorithms=["HS256"]
        )
        rfq_id = decoded_token.get("rfq_id")

        if not rfq_id:
            return jsonify(
                {"code": "error/invalid_token", "message": "Invalid token."}
            ), 400

        # Fetch the RFQ from the database
        rfq = db.session.get(RFQ, rfq_id)
        if not rfq:
            return jsonify(
                {"code": "error/not_found", "message": "RFQ not found."}
            ), 404

        if rfq.response_time is None:
            return jsonify(
                {
                    "code": "error/no_response",
                    "message": "The vendor has not yet replied to the RFQ.",
                }
            ), 400

        rfq.status = RFQStatus.ORDERED
        rfq.response_time = datetime.utcnow()
        db.session.commit()

        return jsonify(
            {
                "code": "success",
                "message": "RFQ status updated to 'ordered' successfully.",
            }
        ), 200

    except jwt.ExpiredSignatureError:
        return jsonify(
            {"code": "error/expired_token", "message": "Token has expired."}
        ), 400
    except jwt.InvalidTokenError:
        return jsonify(
            {"code": "error/invalid_token", "message": "Invalid token."}
        ), 400
