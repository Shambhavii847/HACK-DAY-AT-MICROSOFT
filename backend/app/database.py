from collections.abc import Generator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from .config import settings


class Base(DeclarativeBase):
    pass


_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_schema(bind=engine) -> None:
    """Apply additive, idempotent schema upgrades and preserve existing rows."""
    # Import models here so SQLAlchemy registers every table before create_all.
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=bind)
    # Keep the existing SQLite upgrade for databases created before customer_contact.
    if bind.dialect.name == "sqlite" and "repair_cases" in inspect(bind).get_table_names():
        columns = {column["name"] for column in inspect(bind).get_columns("repair_cases")}
        if "customer_contact" not in columns:
            with bind.begin() as conn:
                conn.execute(text("ALTER TABLE repair_cases ADD COLUMN customer_contact VARCHAR(120)"))
