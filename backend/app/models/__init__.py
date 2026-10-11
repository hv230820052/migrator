"""
SQLAlchemy models - Phase 0/1
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, 
    ForeignKey, JSON, Float, create_engine, event
)
from sqlalchemy.orm import relationship, declarative_base, sessionmaker
from datetime import datetime
from pathlib import Path

Base = declarative_base()

# Create engine and session - use absolute path
db_path = Path(__file__).parent.parent.parent / "data" / "provenance.db"
db_path.parent.mkdir(parents=True, exist_ok=True)
# Use absolute path with URI mode and WAL for proper concurrent locking
engine = create_engine(
    f"sqlite:///{db_path.resolve()}", 
    connect_args={"check_same_thread": False, "timeout": 60}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=60000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

class Source(Base):
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(50), nullable=False)  # svn, tfs, localgit, github
    endpoint = Column(String(500), nullable=False)
    credentials_ref = Column(String(500))
    status = Column(String(50), default="connected")
    readable_scope = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    repos = relationship("Repo", back_populates="source")

class Repo(Base):
    __tablename__ = "repos"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    name = Column(String(200), nullable=False)
    size = Column(Integer, default=0)
    commits = Column(Integer, default=0)
    branches = Column(Integer, default=0)
    tags = Column(Integer, default=0)
    contributors = Column(String(100), default="0")
    last_activity = Column(String(100))
    large_files = Column(Integer, default=0)  # boolean flag
    risk_tier = Column(String(20))
    risk_factors = Column(JSON)
    state = Column(String(50), default="discovered")
    
    source = relationship("Source", back_populates="repos")
    findings = relationship("Finding", back_populates="repo")
    mappings = relationship("Mapping", back_populates="repo")

class Finding(Base):
    __tablename__ = "findings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repos.id"), nullable=False)
    type = Column(String(50), nullable=False)  # secret, large_binary, unmapped_author
    severity = Column(String(20), default="medium")
    location = Column(Text)
    fingerprint = Column(String(100))
    recommendation = Column(Text)
    status = Column(String(20), default="pending")
    
    repo = relationship("Repo", back_populates="findings")

class Mapping(Base):
    __tablename__ = "mappings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repos.id"), nullable=False)
    legacy_id = Column(String(200), nullable=False)
    github_id = Column(String(200), nullable=False)
    method = Column(String(50), default="exact_match")
    confidence = Column(Float, default=0.0)
    status = Column(String(20), default="pending")
    coverage_percent = Column(Float, default=0.0)
    
    repo = relationship("Repo", back_populates="mappings")

class Run(Base):
    __tablename__ = "runs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_ids = Column(JSON)  # list of source IDs
    target_org = Column(String(200))
    status = Column(String(50), default="created")
    token_budget = Column(Integer, default=100000)
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, nullable=True)
    repo_id = Column(Integer, nullable=True)
    agent = Column(String(50))
    action = Column(Text)
    reason = Column(Text)
    tier = Column(String(10), default="T0")
    timestamp = Column(DateTime, default=datetime.utcnow)

class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    gate = Column(String(50), nullable=False)
    run_id = Column(Integer, nullable=True)
    actor = Column(String(100))
    decision = Column(String(20), nullable=False)  # approve, adjust, hold
    reason = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)