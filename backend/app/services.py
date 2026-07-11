import random

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models

SOA_DEFAULT_SUFFIX = "awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"


def gen_name_servers():
    """Generate 4 Route 53-style delegation-set name servers (same numeric ranges AWS uses)."""
    return [
        f"ns-{random.randint(1, 511)}.awsdns-{random.randint(0, 63):02d}.com.",
        f"ns-{random.randint(512, 1023)}.awsdns-{random.randint(0, 63):02d}.net.",
        f"ns-{random.randint(1024, 1535)}.awsdns-{random.randint(0, 63):02d}.org.",
        f"ns-{random.randint(1536, 2047)}.awsdns-{random.randint(0, 63):02d}.co.uk.",
    ]


def normalize_domain(name: str) -> str:
    """Lowercase, trim, and ensure a single trailing dot (Route 53 stores FQDNs)."""
    name = (name or "").strip().lower().rstrip(".")
    return name + "." if name else ""


def create_zone_with_defaults(
    db: Session, name: str, ztype: str, comment: str
) -> models.HostedZone:
    """Create a hosted zone plus its default NS and SOA records, like Route 53 does."""
    zone = models.HostedZone(name=name, type=ztype, comment=comment or "")
    db.add(zone)
    db.flush()
    name_servers = gen_name_servers()
    db.add(
        models.DnsRecord(
            zone_id=zone.id,
            name=zone.name,
            type="NS",
            ttl=172800,
            values="\n".join(name_servers),
            is_default=True,
        )
    )
    db.add(
        models.DnsRecord(
            zone_id=zone.id,
            name=zone.name,
            type="SOA",
            ttl=900,
            values=f"{name_servers[0]} {SOA_DEFAULT_SUFFIX}",
            is_default=True,
        )
    )
    db.commit()
    db.refresh(zone)
    return zone


def record_count(db: Session, zone_id: str) -> int:
    return (
        db.query(func.count(models.DnsRecord.id))
        .filter(models.DnsRecord.zone_id == zone_id)
        .scalar()
        or 0
    )


def zone_to_dict(
    db: Session, zone: models.HostedZone, include_name_servers: bool = False
) -> dict:
    data = {
        "id": zone.id,
        "name": zone.name,
        "type": zone.type,
        "comment": zone.comment or "",
        "record_count": record_count(db, zone.id),
        "created_at": zone.created_at.isoformat() if zone.created_at else None,
    }
    if include_name_servers:
        ns = (
            db.query(models.DnsRecord)
            .filter(
                models.DnsRecord.zone_id == zone.id,
                models.DnsRecord.type == "NS",
                models.DnsRecord.is_default.is_(True),
                models.DnsRecord.name == zone.name,
            )
            .first()
        )
        data["name_servers"] = ns.values.split("\n") if ns else []
    return data


def record_to_dict(r: models.DnsRecord) -> dict:
    return {
        "id": r.id,
        "zone_id": r.zone_id,
        "name": r.name,
        "type": r.type,
        "ttl": r.ttl,
        "values": r.values.split("\n") if r.values else [],
        "is_default": bool(r.is_default),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }
