"""TypedDict definitions for all Commons API resources."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class PaginationMeta(TypedDict, total=False):
    cursor: Optional[str]
    hasMore: bool
    total: int


class ApiEnvelope(TypedDict, total=False):
    data: Any
    meta: PaginationMeta
    error: Optional[Dict[str, str]]


# ---------------------------------------------------------------------------
# Supporters
# ---------------------------------------------------------------------------

class SupporterTag(TypedDict):
    id: str
    name: str


class Supporter(TypedDict, total=False):
    id: str
    email: str
    name: Optional[str]
    postalCode: Optional[str]
    country: Optional[str]
    phone: Optional[str]
    verified: bool
    emailStatus: str
    source: str
    customFields: Optional[Dict[str, Any]]
    createdAt: str
    updatedAt: str
    tags: List[SupporterTag]


class CreateSupporterInput(TypedDict, total=False):
    email: str  # required
    name: str
    postalCode: str
    country: str
    phone: str
    source: str
    customFields: Dict[str, Any]
    tags: List[str]


class UpdateSupporterInput(TypedDict, total=False):
    name: str
    postalCode: str
    country: str
    phone: str
    customFields: Dict[str, Any]


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------

class CampaignCounts(TypedDict, total=False):
    actions: int
    deliveries: int


class Campaign(TypedDict, total=False):
    id: str
    type: str
    title: str
    body: Optional[str]
    status: str
    templateId: Optional[str]
    debateEnabled: bool
    debateThreshold: Optional[int]
    createdAt: str
    updatedAt: str
    counts: CampaignCounts


class CampaignDetail(TypedDict, total=False):
    id: str
    type: str
    title: str
    body: Optional[str]
    status: str
    templateId: Optional[str]
    createdAt: str
    updatedAt: str


class CampaignFull(TypedDict, total=False):
    id: str
    type: str
    title: str
    body: Optional[str]
    status: str
    targets: Optional[Dict[str, Any]]
    templateId: Optional[str]
    debateEnabled: bool
    debateThreshold: Optional[int]
    createdAt: str
    updatedAt: str
    counts: CampaignCounts


class CampaignAction(TypedDict, total=False):
    id: str
    campaignId: str
    supporterId: Optional[str]
    verified: bool
    engagementTier: int
    districtHash: Optional[str]
    sentAt: str
    createdAt: str


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

class Tag(TypedDict, total=False):
    id: str
    name: str
    supporterCount: int


# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

class Usage(TypedDict, total=False):
    verifiedActions: int
    maxVerifiedActions: int
    emailsSent: int
    maxEmails: int


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------

class OrgCounts(TypedDict, total=False):
    supporters: int
    campaigns: int
    templates: int


class OrgInfo(TypedDict, total=False):
    id: str
    name: str
    slug: str
    description: Optional[str]
    avatar: Optional[str]
    createdAt: str
    counts: OrgCounts


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

class Event(TypedDict, total=False):
    id: str
    title: str
    description: Optional[str]
    eventType: str
    startAt: str
    endAt: Optional[str]
    timezone: Optional[str]
    venue: Optional[str]
    city: Optional[str]
    state: Optional[str]
    virtualUrl: Optional[str]
    capacity: Optional[int]
    status: str
    rsvpCount: int
    attendeeCount: int
    verifiedAttendees: int
    campaignId: Optional[str]
    createdAt: str
    updatedAt: str


class EventDetail(TypedDict, total=False):
    id: str
    title: str
    description: Optional[str]
    eventType: str
    startAt: str
    endAt: Optional[str]
    timezone: Optional[str]
    venue: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postalCode: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    virtualUrl: Optional[str]
    capacity: Optional[int]
    waitlistEnabled: bool
    requireVerification: bool
    status: str
    rsvpCount: int
    attendeeCount: int
    verifiedAttendees: int
    campaignId: Optional[str]
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Donations
# ---------------------------------------------------------------------------

class Donation(TypedDict, total=False):
    id: str
    campaignId: str
    email: str
    name: Optional[str]
    amountCents: int
    currency: str
    recurring: bool
    status: str
    engagementTier: int
    completedAt: Optional[str]
    createdAt: str


class DonationDetail(TypedDict, total=False):
    id: str
    campaignId: str
    email: str
    name: Optional[str]
    amountCents: int
    currency: str
    recurring: bool
    recurringInterval: Optional[str]
    status: str
    engagementTier: int
    districtHash: Optional[str]
    stripeSessionId: Optional[str]
    completedAt: Optional[str]
    createdAt: str


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------

class Workflow(TypedDict, total=False):
    id: str
    name: str
    description: Optional[str]
    trigger: str
    stepCount: int
    enabled: bool
    createdAt: str
    updatedAt: str


class WorkflowDetail(TypedDict, total=False):
    id: str
    name: str
    description: Optional[str]
    trigger: str
    steps: List[Dict[str, Any]]
    stepCount: int
    enabled: bool
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# SMS + Calling
# ---------------------------------------------------------------------------

class SmsBlast(TypedDict, total=False):
    id: str
    body: str
    fromNumber: Optional[str]
    status: str
    totalRecipients: int
    sentCount: int
    failedCount: int
    campaignId: Optional[str]
    sentAt: Optional[str]
    createdAt: str
    updatedAt: str


class PatchThroughCall(TypedDict, total=False):
    id: str
    callerPhone: str
    targetPhone: str
    targetName: Optional[str]
    status: str
    duration: Optional[int]
    twilioCallSid: Optional[str]
    campaignId: Optional[str]
    districtHash: Optional[str]
    createdAt: str
    updatedAt: str


# ---------------------------------------------------------------------------
# Representatives
# ---------------------------------------------------------------------------

class Representative(TypedDict, total=False):
    id: str
    countryCode: str
    constituencyId: Optional[str]
    constituencyName: Optional[str]
    name: str
    party: Optional[str]
    chamber: Optional[str]
    office: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    websiteUrl: Optional[str]
    photoUrl: Optional[str]
    createdAt: str
    updatedAt: str
