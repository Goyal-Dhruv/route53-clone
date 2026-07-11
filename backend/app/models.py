import secrets
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


def gen_zone_id():
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "Z" + "".join(secrets.choice(alphabet) for _ in range(14))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class SessionToken(Base):
    __tablename__ = "sessions"

    token = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User")


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id = Column(String, primary_key=True, default=gen_zone_id)
    name = Column(String, index=True, nullable=False)  # always stored as FQDN, e.g. "example.com."
    type = Column(String, default="public")  # "public" | "private"
    comment = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)

    records = relationship(
        "DnsRecord", back_populates="zone", cascade="all, delete-orphan"
    )


class DnsRecord(Base):
    __tablename__ = "dns_records"

    id = Column(Integer, primary_key=True)
    zone_id = Column(String, ForeignKey("hosted_zones.id"), nullable=False, index=True)
    name = Column(String, index=True, nullable=False)  # FQDN, e.g. "www.example.com."
    type = Column(String, nullable=False)
    ttl = Column(Integer, default=300)
    values = Column(Text, nullable=False)  # newline-separated values
    is_default = Column(Boolean, default=False)  # NS/SOA created with the zone
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    zone = relationship("HostedZone", back_populates="records")
