from sqlalchemy.orm import Session

from . import models
from .services import create_zone_with_defaults


def seed_if_empty(db: Session) -> None:
    """Seed a sample hosted zone the first time the app boots so the demo
    isn't an empty screen."""
    if db.query(models.HostedZone).count() > 0:
        return
    zone = create_zone_with_defaults(
        db, "example.com.", "public", "Sample hosted zone created for the demo"
    )
    samples = [
        ("example.com.", "A", 300, "192.0.2.44\n198.51.100.10"),
        ("www.example.com.", "A", 300, "192.0.2.44"),
        ("blog.example.com.", "CNAME", 300, "www.example.com."),
        ("staging.example.com.", "CNAME", 300, "www.example.com."),
        ("example.com.", "MX", 300, "10 mail.example.com."),
        ("example.com.", "TXT", 300, "v=spf1 include:_spf.example.com ~all"),
        ("mail.example.com.", "A", 300, "203.0.113.25"),
        ("api.example.com.", "A", 300, "192.0.2.10"),
        ("dev.example.com.", "A", 60, "192.0.2.11"),
        ("_sip._tcp.example.com.", "SRV", 300, "1 10 5060 sip.example.com."),
        ("example.com.", "CAA", 300, '0 issue "letsencrypt.org"'),
    ]
    for name, rtype, ttl, values in samples:
        db.add(
            models.DnsRecord(
                zone_id=zone.id, name=name, type=rtype, ttl=ttl, values=values
            )
        )
    db.commit()
