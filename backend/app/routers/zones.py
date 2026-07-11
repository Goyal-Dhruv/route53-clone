from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas, services
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(
    prefix="/api/zones",
    tags=["hosted-zones"],
    dependencies=[Depends(get_current_user)],
)


def _get_zone_or_404(db: Session, zone_id: str) -> models.HostedZone:
    zone = db.get(models.HostedZone, zone_id)
    if not zone:
        raise HTTPException(
            status_code=404, detail=f"No hosted zone found with ID: {zone_id}"
        )
    return zone


@router.get("")
def list_zones(
    search: str = "",
    zone_type: str = Query(default="", alias="type"),
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
):
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    q = db.query(models.HostedZone)
    if search:
        like = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                models.HostedZone.name.like(like),
                models.HostedZone.comment.like(like),
                models.HostedZone.id.like(like),
            )
        )
    if zone_type in ("public", "private"):
        q = q.filter(models.HostedZone.type == zone_type)
    total = q.count()
    zones = (
        q.order_by(models.HostedZone.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [services.zone_to_dict(db, z) for z in zones],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
def create_zone(payload: schemas.ZoneCreate, db: Session = Depends(get_db)):
    name = services.normalize_domain(payload.name)
    if not name or "." not in name.rstrip(".") or not schemas.DOMAIN_RE.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"'{payload.name}' is not a valid domain name. Example: example.com",
        )
    existing = db.query(models.HostedZone).filter(models.HostedZone.name == name).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A hosted zone with the name {name} already exists.",
        )
    zone = services.create_zone_with_defaults(db, name, payload.type, payload.comment)
    return services.zone_to_dict(db, zone, include_name_servers=True)


@router.get("/{zone_id}")
def get_zone(zone_id: str, db: Session = Depends(get_db)):
    zone = _get_zone_or_404(db, zone_id)
    return services.zone_to_dict(db, zone, include_name_servers=True)


@router.patch("/{zone_id}")
def update_zone(
    zone_id: str, payload: schemas.ZoneUpdate, db: Session = Depends(get_db)
):
    zone = _get_zone_or_404(db, zone_id)
    if payload.comment is not None:
        zone.comment = payload.comment
    db.commit()
    db.refresh(zone)
    return services.zone_to_dict(db, zone, include_name_servers=True)


@router.delete("/{zone_id}")
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    zone = _get_zone_or_404(db, zone_id)
    non_default = (
        db.query(models.DnsRecord)
        .filter(
            models.DnsRecord.zone_id == zone_id,
            models.DnsRecord.is_default.is_(False),
        )
        .count()
    )
    if non_default > 0:
        # Mirrors Route 53's HostedZoneNotEmpty behaviour.
        raise HTTPException(
            status_code=409,
            detail=(
                "HostedZoneNotEmpty: The specified hosted zone contains non-required "
                "resource record sets and so cannot be deleted. Delete all records "
                "except the default NS and SOA records, then try again."
            ),
        )
    db.delete(zone)
    db.commit()
    return {"ok": True, "id": zone_id}


@router.get("/{zone_id}/export")
def export_zone(zone_id: str, format: str = "json", db: Session = Depends(get_db)):
    zone = _get_zone_or_404(db, zone_id)
    records = (
        db.query(models.DnsRecord).filter(models.DnsRecord.zone_id == zone_id).all()
    )
    order = {"SOA": 0, "NS": 1}
    records.sort(key=lambda r: (order.get(r.type, 2), r.name, r.type))
    if format == "bind":
        lines = [f"$ORIGIN {zone.name}", "$TTL 300", ""]
        for r in records:
            for v in r.values.split("\n"):
                value = v
                if r.type == "TXT" and not value.startswith('"'):
                    value = f'"{value}"'
                lines.append(f"{r.name}\t{r.ttl}\tIN\t{r.type}\t{value}")
        filename = zone.name.rstrip(".") + ".zone"
        return PlainTextResponse(
            "\n".join(lines) + "\n",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return JSONResponse(
        {
            "hosted_zone": services.zone_to_dict(db, zone, include_name_servers=True),
            "records": [services.record_to_dict(r) for r in records],
        }
    )
