import enum
import logging
import os
from datetime import datetime
from uuid import uuid4

from flask_sqlalchemy import SQLAlchemy
from snowflake import SnowflakeGenerator
from sqlalchemy import Enum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm._orm_constructors import relationship
from sqlalchemy.sql import expression, func
from sqlalchemy.sql.schema import ForeignKey


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)

gen = SnowflakeGenerator(42)


class Package(enum.Enum):
    basic = (5, 20)
    premium = (10, 30)
    deluxe = (15, 50)


class Company(db.Model):
    __tablename__ = "company"

    id: Mapped[int] = mapped_column(
        db.BigInteger, primary_key=True, insert_default=lambda: next(gen)
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


class User(db.Model):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(db.String(128), primary_key=True)
    fullname: Mapped[str] = mapped_column(db.String(150), nullable=True)
    join_date: Mapped[datetime] = mapped_column(
        db.DateTime, nullable=False, server_default=func.now()
    )
    token_id: Mapped[str] = mapped_column(
        ForeignKey("token.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    token: Mapped["Token"] = relationship(back_populates="user")


class Position(enum.Enum):
    manager = "Manager"
    executive = "Executive"
    admin = "Admin"


class Token(db.Model):
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


# class Vendor(db.Model):
#     __tablename__ = "vendor"

#     id: Mapped[int] = mapped_column(db.String(128), primary_key=True)
#     name: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     address: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     email: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     company_size: Mapped[CompanySize] = mapped_column(Enum(CompanySize))
#     pic_phone_number: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     bank_name: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     bank_acc_number: Mapped[int] = mapped_column(db.Integer, nullable=True)
#     gred: Mapped[Gred] = mapped_column(Enum(Gred))
#     rfqs: Mapped[list["RFQ"]] = relationship(back_populates="vendor")
#     purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
#         "PurchaseOrder", back_populates="vendor"
#     )


# class Item(db.Model):
#     __tablename__ = "item"

#     id: Mapped[int] = mapped_column(db.String(128), primary_key=True)
#     name: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     address: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     category: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     price: Mapped[int] = mapped_column(db.Integer, nullable=True)
#     quantity: Mapped[int] = mapped_column(db.Integer, nullable=True)
#     rfq_id: Mapped[int] = mapped_column(ForeignKey("rfq.id"))
#     rfqs: Mapped["RFQ"] = relationship(back_populates="item")
#     purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
#         "PurchaseOrder", back_populates="item"
#     )


# class RFQ(db.Model):
#     __tablename__ = "rfq"

#     id: Mapped[int] = mapped_column(db.String(128), primary_key=True)
#     pic_name: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     date: Mapped[datetime] = mapped_column(
#         db.DateTime, nullable=False, server_default=func.now()
#     )
#     expired_date: Mapped[datetime] = mapped_column(db.DateTime, nullable=False)
#     payment_term: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     total_price: Mapped[str] = mapped_column(db.String(150), nullable=True)
#     vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.id"))
#     vendor: Mapped["Vendor"] = relationship(back_populates="rfqs")
#     item_id: Mapped[int] = mapped_column(ForeignKey("item.id"))
#     item: Mapped["Item"] = relationship(back_populates="rfqs")

#     def __init__(self, **kwargs):
#         super().__init__(**kwargs)
#         if not self.expired_date:
#             self.expired_date = (
#                 self.date + timedelta(days=30)
#                 if self.date
#                 else datetime.now() + timedelta(days=30)
#             )


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


def init_db(app):
    global db
    production = os.environ["PRODUCTION"] == "1"
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        os.environ["DATABASE_URL_PROD"] if production else os.environ["DATABASE_URL"]
    )
    db.init_app(app)
    with app.app_context():
        # # Disable foreign key checks (specific to MySQL or MariaDB)
        # db.session.execute(text('SET FOREIGN_KEY_CHECKS = 0'))
        # db.session.commit()

        # # Force delete all rows in each table
        # db.session.query(Token).delete()
        # db.session.query(User).delete()
        # db.session.query(Company).delete()
        # db.session.commit()

        # # Drop all tables
        # db.drop_all()

        # # Enable foreign key checks again (specific to MySQL or MariaDB)
        # db.session.execute(text('SET FOREIGN_KEY_CHECKS = 1'))
        # db.session.commit()
        db.create_all()
    logging.info("Database successfully initialized")
