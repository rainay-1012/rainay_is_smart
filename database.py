import enum
import logging
import os

from flask_sqlalchemy import SQLAlchemy
from snowflake import SnowflakeGenerator
from sqlalchemy import Enum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm._orm_constructors import relationship
from sqlalchemy.sql import expression
from sqlalchemy.sql.schema import ForeignKey


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)

gen = SnowflakeGenerator(42)


class Company(db.Model):
    __tablename__ = "company"

    id: Mapped[int] = mapped_column(
        db.BigInteger, primary_key=True, insert_default=lambda: next(gen)
    )
    name: Mapped[str] = mapped_column(db.String(150), nullable=False)
    address: Mapped[str] = mapped_column(db.String(300), nullable=False)
    # users: Mapped[list["User"]] = relationship(back_populates="company")
    tokens: Mapped[list["Token"]] = relationship(back_populates="company")


class Position(enum.Enum):
    manager = "Manager"
    executive = "Executive"
    admin = "Admin"


class User(db.Model):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    fullname: Mapped[str] = mapped_column(db.String(150))
    status: Mapped[bool] = mapped_column(
        db.Boolean, server_default=expression.true(), default=True, nullable=False
    )
    # position: Mapped[Position] = mapped_column(Enum(Position))
    # company_id: Mapped[int] = mapped_column(ForeignKey("company.id"))
    # company: Mapped["Company"] = relationship(back_populates="tokens")
    token: Mapped["Token"] = relationship(back_populates="user")


class Token(db.Model):
    __tablename__ = "token"
    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    position: Mapped[Position] = mapped_column(Enum(Position))
    company_id: Mapped[int] = mapped_column(ForeignKey("company.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    company: Mapped["Company"] = relationship(back_populates="tokens")
    user: Mapped["User"] = relationship(back_populates="token")


def init_db(app):
    global db
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    db.init_app(app)
    with app.app_context():
        db.drop_all()
        db.create_all()
    logging.info("Database successfully initialized")
