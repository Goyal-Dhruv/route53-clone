import re
from typing import List, Optional

from pydantic import BaseModel, field_validator

USER_RECORD_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"]
ALL_RECORD_TYPES = USER_RECORD_TYPES + ["SOA"]

# Permissive DNS name validation: labels of letters/digits/hyphens/underscores,
# wildcard label allowed, optional trailing dot.
DOMAIN_RE = re.compile(
    r"^(?:[A-Za-z0-9_*](?:[A-Za-z0-9\-_]{0,61}[A-Za-z0-9_])?\.)+"
    r"[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.?$"
)


class LoginRequest(BaseModel):
    email: str
    password: str


class ZoneCreate(BaseModel):
    name: str
    type: str = "public"
    comment: str = ""

    @field_validator("type")
    @classmethod
    def check_type(cls, v: str) -> str:
        if v not in ("public", "private"):
            raise ValueError("type must be 'public' or 'private'")
        return v


class ZoneUpdate(BaseModel):
    comment: Optional[str] = None


class RecordPayload(BaseModel):
    name: str = ""  # subdomain part, "@", or full FQDN
    type: str
    ttl: int = 300
    values: List[str]


class BulkDeletePayload(BaseModel):
    ids: List[int]
