import enum
import hashlib
import os
from datetime import datetime
from uuid import uuid4

from flask_sqlalchemy import SQLAlchemy
from snowflake import SnowflakeGenerator
from sqlalchemy import Column, Enum, Integer, String, Table, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm._orm_constructors import relationship
from sqlalchemy.sql import expression, func
from sqlalchemy.sql.schema import ForeignKey


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)

gen = SnowflakeGenerator(42)


class BaseModel(Base):
    __abstract__ = True

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class Package(enum.Enum):
    basic = (5, 20)
    premium = (10, 30)
    deluxe = (15, 50)


class Company(BaseModel, db.Model):
    __tablename__ = "company"

    id: Mapped[str] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    name: Mapped[str] = mapped_column(db.String(150), nullable=False)
    address: Mapped[str] = mapped_column(db.String(300), nullable=False)
    package: Mapped[Package] = mapped_column(Enum(Package))
    email: Mapped[str] = mapped_column(db.String(60), nullable=False)
    join_date: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )
    tokens: Mapped[list["Token"]] = relationship(
        "Token", back_populates="company", cascade="all, delete-orphan"
    )
    items: Mapped[list["Item"]] = relationship(
        "Item", back_populates="company", cascade="all, delete-orphan"
    )
    rfqs: Mapped[list["RFQ"]] = relationship(
        "RFQ", back_populates="company", cascade="all, delete-orphan"
    )
    vendors: Mapped[list["Vendor"]] = relationship(
        "Vendor", back_populates="company", cascade="all, delete-orphan"
    )
    categories: Mapped[list["Category"]] = relationship(
        "Category", back_populates="company", cascade="all, delete-orphan"
    )


class User(BaseModel, db.Model):
    __tablename__ = "user"

    id: Mapped[str] = mapped_column(db.String(128), primary_key=True)
    fullname: Mapped[str] = mapped_column(db.String(150), nullable=True)
    join_date: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )
    token_id: Mapped[str] = mapped_column(
        ForeignKey("token.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    token: Mapped["Token"] = relationship(back_populates="user")


class Position(enum.Enum):
    executive = 0
    manager = 1
    admin = 2


class Token(BaseModel, db.Model):
    __tablename__ = "token"

    id: Mapped[str] = mapped_column(
        db.String(32), primary_key=True, insert_default=lambda: uuid4().hex
    )
    position: Mapped[Position] = mapped_column(Enum(Position))
    status: Mapped[bool] = mapped_column(
        db.Boolean, server_default=expression.false(), default=False, nullable=False
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("company.id", ondelete="CASCADE")
    )
    company: Mapped["Company"] = relationship(back_populates="tokens")
    user: Mapped["User"] = relationship(
        back_populates="token", cascade="all, delete-orphan"
    )


# class CompanySize(enum.Enum):
#     small = "Small"
#     medium = "Medium"
#     big = "Big"


# class Gred(enum.Enum):
#     A = "A"
#     B = "B"
#     C = "C"
#     D = "D"
#     E = "E"

item_category_association = Table(
    "item_category",``
    db.metadata,
    Column(
        "item_id",
        String(128),
        ForeignKey("item.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        Integer,
        ForeignKey("category.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


vendor_category_association = Table(
    "vendor_category",
    db.metadata,
    Column(
        "vendor_id",
        String(128),
        ForeignKey("vendor.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        Integer,
        ForeignKey("category.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Category(BaseModel, db.Model):
    __tablename__ = "category"

    id: Mapped[str] = mapped_column(db.Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(db.String(150), nullable=False, unique=True)
    items = relationship(
        "Item", secondary=item_category_association, back_populates="categories"
    )
    vendors = relationship(
        "Vendor", secondary=vendor_category_association, back_populates="categories"
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("company.id", ondelete="CASCADE"), nullable=False
    )
    company: Mapped["Company"] = relationship("Company", back_populates="categories")


class Item(BaseModel, db.Model):
    __tablename__ = "item"

    id: Mapped[str] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    name: Mapped[str] = mapped_column(db.String(150), nullable=False)
    photo: Mapped[str] = mapped_column(db.String(300), nullable=True)
    last_update: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("company.id", ondelete="CASCADE"), nullable=False
    )
    company: Mapped["Company"] = relationship("Company", back_populates="items")
    categories = relationship(
        "Category", secondary=item_category_association, back_populates="items"
    )


class Vendor(BaseModel, db.Model):
    __tablename__ = "vendor"

    id: Mapped[int] = mapped_column(
        db.String(128), primary_key=True, insert_default=lambda: next(gen)
    )
    name: Mapped[str] = mapped_column(db.String(150), nullable=True)
    categories = relationship(
        "Category", secondary=vendor_category_association, back_populates="vendors"
    )
    email: Mapped[str] = mapped_column(db.String(150), nullable=True)
    address: Mapped[str] = mapped_column(db.String(150), nullable=True)
    approved: Mapped[bool] = mapped_column(db.Boolean, default=False)
    gred: Mapped[float] = mapped_column(db.Float, nullable=False, default=0)
    rfqs: Mapped[list["RFQ"]] = relationship(
        "RFQ", back_populates="vendor", cascade="all, delete-orphan"
    )
    company_id: Mapped[str] = mapped_column(
        ForeignKey("company.id", ondelete="CASCADE"), nullable=False
    )
    company: Mapped["Company"] = relationship("Company", back_populates="vendors")
    # purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
    #     "PurchaseOrder", back_populates="vendor"
    # )


class RFQ(BaseModel, db.Model):
    __tablename__ = "rfq"

    id: Mapped[str] = mapped_column(db.String(128), primary_key=True)
    date: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )
    procurement_id: Mapped[str] = mapped_column(
        db.String(128), ForeignKey("procurement.id", ondelete="CASCADE"), nullable=False
    )
    procurement: Mapped["Procurement"] = relationship(
        "Procurement", back_populates="rfqs", cascade="all"
    )
    company_id: Mapped[str] = mapped_column(
        ForeignKey("company.id", ondelete="CASCADE"), nullable=False
    )
    company: Mapped["Company"] = relationship("Company", back_populates="rfqs")
    vendor_id: Mapped[str] = mapped_column(
        ForeignKey("vendor.id", ondelete="CASCADE"), nullable=False
    )
    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="rfqs")

    response_time: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=True, server_default=func.now()
    )


class ProcurementItem(BaseModel, db.Model):
    __tablename__ = "procurement_item"

    procurement_id: Mapped[str] = mapped_column(
        db.String(128),
        ForeignKey("procurement.id", ondelete="CASCADE"),
        primary_key=True,
    )
    Procurement: Mapped["Procurement"] = relationship(back_populates="items")
    item_id: Mapped[str] = mapped_column(
        db.String(128), ForeignKey("item.id", ondelete="CASCADE"), primary_key=True
    )
    quantity: Mapped[int] = mapped_column(db.Integer, nullable=True)
    unit_price: Mapped[str] = mapped_column(db.Numeric(10, 2), nullable=True)


class Procurement(BaseModel, db.Model):
    __tablename__ = "procurement"

    id: Mapped[str] = mapped_column(db.String(128), primary_key=True)
    rfqs: Mapped[list["RFQ"]] = relationship(
        "RFQ", back_populates="procurement", cascade="all, delete-orphan"
    )
    items: Mapped[list["ProcurementItem"]] = relationship(
        "ProcurementItem", back_populates="Procurement", cascade="all"
    )


# class PurchaseOrder(db.Model):
#     __tablename__ = "purchase_order"

#     id: Mapped[int] = mapped_column(db.String(128), primary_key=True)
#     date: Mapped[datetime] = mapped_column(
#         db.DateTime, nullable=False, server_default=func.now()
#     )
#     payment_term: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.id"))
#     vendor: Mapped["Vendor"] = relationship(back_populates="purchase_orders")
#     item_id: Mapped[int] = mapped_column(ForeignKey("item.id"))
#     item: Mapped["Item"] = relationship(back_populates="purchase_orders")


TABLES_METADATA = {
    "item": {
        "description": "Represents a inventory item managed by a company. Each item can belong to multiple categories and is associated with a specific company.",
        "columns": {
            "name": {
                "type": "string",
                "description": "Name of the item, used for identification and display purposes.",
                "sample_data": ["Laptop", "Office Chair", "Printer Ink", "Desk Lamp"],
            },
            "last_update": {
                "type": "datetime",
                "description": "Timestamp of the last update made to the item, used for tracking changes.",
                "sample_data": [
                    "2024-12-10 08:45:00",
                    "2024-11-22 10:30:45",
                    "2024-12-01 12:15:25",
                    "2024-10-15 16:40:10",
                ],
            },
        },
        "relationships": {
            "category": {
                "type": "many-to-many",
                "description": "Each item can belong to multiple categories for organizational purposes.",
            },
        },
    },
    "category": {
        "description": "Represents a classification or grouping for items and vendors, useful for aggregating and visualizing data.",
        "columns": {
            "name": {
                "type": "string",
                "description": "The name of the category, used for analyzing popular or frequently used groupings.",
                "sample_data": [
                    "Electronics",
                    "Furniture",
                    "Office Supplies",
                    "Lighting",
                ],
            },
        },
        "relationships": {
            "item": {
                "type": "many-to-many",
                "description": "Insights into the number of items under each category, supporting inventory distribution analysis.",
            },
            "vendor": {
                "type": "many-to-many",
                "description": "Tracks vendor associations with categories, enabling analysis of supplier diversity or specialization.",
            },
        },
    },
}


admin_token_count = 10


def generate_fixed_tokens(count, prefix="admin", salt="fixed_salt"):
    tokens = []
    for i in range(count):
        raw_token = f"{prefix}-{i}-{salt}"
        hashed_token = hashlib.sha256(raw_token.encode()).hexdigest()
        tokens.append(hashed_token[:16])  # Shorten token for readability
    return tokens


def init_db_test():
    admin_tokens = generate_fixed_tokens(admin_token_count)

    try:
        test_company = Company(
            id="test",
            name="Test Company",
            address="123 Test Lane, Test City, TS 12345",
            package=Package.basic,
            email="testcompany@example.com",
        )
        db.session.add(test_company)

        admin_token_objects = [
            Token(
                id=token,
                position=Position.admin,
                status=True,
                company=test_company,
            )
            for token in admin_tokens
        ]

        token1 = Token(
            id="MbMPw4Ev3oXNUWLb6ghtsFY3u7d2",
            position=Position.admin,
            status=True,
            company=test_company,  # Link the token to the test company
        )
        token2 = Token(
            id="5h1iQMY2zSgF6bmZDv2fp3HcVSG3",
            position=Position.manager,
            status=True,
            company=test_company,
        )
        token3 = Token(
            id="g9qy3Gu2b5a55F4Ymn8b6zPh1i03",
            position=Position.executive,
            status=True,
            company=test_company,
        )
        db.session.add_all([token1, token2, token3])
        db.session.add_all(admin_token_objects)

        user1 = User(
            id="MbMPw4Ev3oXNUWLb6ghtsFY3u7d2",
            fullname="Admin User",
            token=token1,
        )
        user2 = User(
            id="5h1iQMY2zSgF6bmZDv2fp3HcVSG3",
            fullname="Manager User",
            token=token2,
        )
        user3 = User(
            id="g9qy3Gu2b5a55F4Ymn8b6zPh1i03",
            fullname="Executive User",
            token=token3,
        )
        db.session.add_all([user1, user2, user3])
        db.session.commit()

    except (Exception, SQLAlchemyError):
        db.session.rollback()
        pass


def force_drop_db():
    # Disable foreign key checks (specific to MySQL or MariaDB)
    db.session.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    db.session.commit()

    # Drop all tables
    db.drop_all()
    db.session.commit()


def init_db(app):
    global db
    production = os.environ["PRODUCTION"] == "1"
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        os.environ["DATABASE_URL_PROD"] if production else os.environ["DATABASE_URL"]
    )
    db.init_app(app)
    with app.app_context():
        init_db_test()
        # force_drop_db()
        db.session.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

        db.create_all()
        db.session.commit()
        META_DATA = db.Model.metadata
        META_DATA.reflect(bind=db.engine)

    app.logger.debug("Database successfully initialized")
