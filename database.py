import os
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import expression
from werkzeug.security import generate_password_hash
from sqlalchemy import Enum
import enum


ip = os.environ["DATABASE_IP"]
port = os.environ["DATABASE_PORT"]
user = os.environ["DATABASE_USER"]
password = os.environ["DATABASE_PASSWORD"]
name = os.environ["DATABASE_NAME"]

url=f"mysql+pymysql://{user}:{password}@{ip}:{port}/{name}"

db = SQLAlchemy()

class Base(DeclarativeBase):
    pass

class Position(enum.Enum):
    manager = "Manager"
    executive = "Executive"
    admin = "Admin"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    phone_number: Mapped[str] = mapped_column(db.String(15), nullable=False)
    status: Mapped[bool] = mapped_column(db.Boolean, server_default=expression.true(), default=True, nullable=False)
    position: Mapped[Position] = mapped_column(Enum(Position))

def init_db(app):
    global db
    app.config["SQLALCHEMY_DATABASE_URI"] = url
    db.init_app(app)
    with app.app_context():
        db.drop_all()
        db.create_all()
    print("Database initialized!")
