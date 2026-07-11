import ipaddress

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas, services
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(
    prefix="/api/zones/{zone_id}/records",
    tags=["records"],
    dependencies=[Depends(get_current_user)],
)


def _get_zone_or_404(db: Session, zone_id: str) -> models.HostedZone:
    zone = db.get(models.HostedZone, zone_id)
    if not zone:
        raise HTTPException(
            status_code=404, detail=f"No hosted zone found with ID: {zone_id}"
        )
    return zone


def _normalize_record_name(zone: models.HostedZone, raw: str) -> str:
    """Accepts '', '@', 'www' or a full FQDN and returns a normalized FQDN
    guaranteed to live inside the zone."""
    raw = (raw or "").strip().lower().rstrip(".")
    if raw in ("", "@"):
        return zone.name
    candidate = raw + "."
    if candidate == zone.name:
        return zone.name
    if candidate.endswith("." + zone.name):
        fqdn = candidate
    else:
        fqdn = candidate + zone.name
    if not schemas.DOMAIN_RE.match(fqdn):
        raise HTTPException(
            status_code=400, detail=f"'{fqdn}' is not a valid record name."
        )
    return fqdn


def _validate_values(zone: models.HostedZone, fqdn: str, rtype: str, ttl: int, values):
    if rtype not in schemas.USER_RECORD_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported record type: {rtype}")
    if ttl < 0 or ttl > 2147483647:
        raise HTTPException(
            status_code=400, detail="TTL must be between 0 and 2147483647 seconds."
        )
    clean = [v.strip() for v in values if v and v.strip()]
    if not clean:
        raise HTTPException(status_code=400, detail="At least one value is required.")
    if rtype == "A":
        for v in clean:
            try:
                ipaddress.IPv4Address(v)
            except ValueError:
                raise HTTPException(
                    status_code=400, detail=f"'{v}' is not a valid IPv4 address."
                )
    if rtype == "AAAA":
        for v in clean:
            try:
                ipaddress.IPv6Address(v)
            except ValueError:
                raise HTTPException(
                    status_code=400, detail=f"'{v}' is not a valid IPv6 address."
                )
    if rtype == "CNAME":
        if len(clean) > 1:
            raise HTTPException(
                status_code=400, detail="A CNAME record can only contain a single value."
            )
        if fqdn == zone.name:
            # Route 53's exact restriction at the zone apex.
            raise HTTPException(
                status_code=400,
                detail=(
                    f"RRSet of type CNAME with DNS name {zone.name} is not permitted "
                    f"at apex in zone {zone.name}."
                ),
            )
    if rtype == "MX":
        for v in clean:
            parts = v.split()
            if len(parts) < 2 or not parts[0].isdigit():
                raise HTTPException(
                    status_code=400,
                    detail=f"MX values must look like '10 mail.example.com.' — got '{v}'.",
                )
    if rtype == "SRV":
        for v in clean:
            parts = v.split()
            if len(parts) != 4 or not all(p.isdigit() for p in parts[:3]):
                raise HTTPException(
                    status_code=400,
                    detail=f"SRV values must look like '1 10 5269 xmpp.example.com.' — got '{v}'.",
                )
    return clean


@router.get("")
def list_records(
    zone_id: str,
    search: str = "",
    record_type: str = Query(default="", alias="type"),
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
):
    _get_zone_or_404(db, zone_id)
    page = max(1, page)
    page_size = min(max(1, page_size), 200)
    q = db.query(models.DnsRecord).filter(models.DnsRecord.zone_id == zone_id)
    if search:
        like = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                models.DnsRecord.name.like(like),
                models.DnsRecord.values.like(like),
                models.DnsRecord.type.like(like),
            )
        )
    if record_type:
        q = q.filter(models.DnsRecord.type == record_type.upper())
    total = q.count()
    rows = (
        q.order_by(models.DnsRecord.name.asc(), models.DnsRecord.type.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [services.record_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
def create_record(
    zone_id: str, payload: schemas.RecordPayload, db: Session = Depends(get_db)
):
    zone = _get_zone_or_404(db, zone_id)
    fqdn = _normalize_record_name(zone, payload.name)
    rtype = payload.type.upper()
    clean = _validate_values(zone, fqdn, rtype, payload.ttl, payload.values)
    dup = (
        db.query(models.DnsRecord)
        .filter(
            models.DnsRecord.zone_id == zone_id,
            models.DnsRecord.name == fqdn,
            models.DnsRecord.type == rtype,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Tried to create a record set of type {rtype} with name {fqdn}, "
                "but it already exists."
            ),
        )
    rec = models.DnsRecord(
        zone_id=zone_id, name=fqdn, type=rtype, ttl=payload.ttl, values="\n".join(clean)
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return services.record_to_dict(rec)


@router.post("/bulk-delete")
def bulk_delete(
    zone_id: str, payload: schemas.BulkDeletePayload, db: Session = Depends(get_db)
):
    _get_zone_or_404(db, zone_id)
    rows = (
        db.query(models.DnsRecord)
        .filter(
            models.DnsRecord.zone_id == zone_id,
            models.DnsRecord.id.in_(payload.ids),
        )
        .all()
    )
    deleted, skipped = 0, 0
    for rec in rows:
        if rec.is_default:
            skipped += 1
        else:
            db.delete(rec)
            deleted += 1
    db.commit()
    return {"deleted": deleted, "skipped_default": skipped}


@router.put("/{record_id}")
def update_record(
    zone_id: str,
    record_id: int,
    payload: schemas.RecordPayload,
    db: Session = Depends(get_db),
):
    zone = _get_zone_or_404(db, zone_id)
    rec = db.get(models.DnsRecord, record_id)
    if not rec or rec.zone_id != zone_id:
        raise HTTPException(status_code=404, detail="Record not found.")
    if rec.is_default:
        # Default NS/SOA: allow TTL/value edits only, like Route 53.
        clean = [v.strip() for v in payload.values if v and v.strip()]
        if not clean:
            raise HTTPException(status_code=400, detail="At least one value is required.")
        if payload.ttl < 0 or payload.ttl > 2147483647:
            raise HTTPException(
                status_code=400, detail="TTL must be between 0 and 2147483647 seconds."
            )
        rec.ttl = payload.ttl
        rec.values = "\n".join(clean)
    else:
        fqdn = _normalize_record_name(zone, payload.name)
        rtype = payload.type.upper()
        clean = _validate_values(zone, fqdn, rtype, payload.ttl, payload.values)
        dup = (
            db.query(models.DnsRecord)
            .filter(
                models.DnsRecord.zone_id == zone_id,
                models.DnsRecord.name == fqdn,
                models.DnsRecord.type == rtype,
                models.DnsRecord.id != record_id,
            )
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=409,
                detail=f"A record set of type {rtype} with name {fqdn} already exists.",
            )
        rec.name = fqdn
        rec.type = rtype
        rec.ttl = payload.ttl
        rec.values = "\n".join(clean)
    db.commit()
    db.refresh(rec)
    return services.record_to_dict(rec)


@router.delete("/{record_id}")
def delete_record(zone_id: str, record_id: int, db: Session = Depends(get_db)):
    _get_zone_or_404(db, zone_id)
    rec = db.get(models.DnsRecord, record_id)
    if not rec or rec.zone_id != zone_id:
        raise HTTPException(status_code=404, detail="Record not found.")
    if rec.is_default:
        raise HTTPException(
            status_code=400,
            detail=(
                "The default NS and SOA records are required by the hosted zone "
                "and cannot be deleted."
            ),
        )
    db.delete(rec)
    db.commit()
    return {"ok": True, "id": record_id}
