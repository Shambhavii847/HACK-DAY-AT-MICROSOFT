from collections.abc import Generator
from sqlalchemy import create_engine
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


def create_schema() -> None:
    # Import models here so SQLAlchemy registers every table before create_all.
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Ensure customer_contact column exists and remove legacy columns on SQLite tables
    try:
        with engine.connect() as conn:
            from sqlalchemy import text
            res = conn.execute(text("PRAGMA table_info(repair_cases)")).fetchall()
            col_names = [row[1] for row in res]
            if "customer_contact" not in col_names and "id" in col_names:
                conn.execute(text("ALTER TABLE repair_cases ADD COLUMN customer_contact VARCHAR(120)"))
            if "assigned_to" in col_names:
                try:
                    conn.execute(text("ALTER TABLE repair_cases DROP COLUMN assigned_to"))
                except Exception:
                    pass
            if "customer_reference" in col_names:
                try:
                    conn.execute(text("ALTER TABLE repair_cases DROP COLUMN customer_reference"))
                except Exception:
                    pass
            conn.commit()
    except Exception:
        pass
