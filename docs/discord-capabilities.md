# Discord Capability Matrix

The detailed matrix and evidence are maintained in [`research/discord-capabilities.md`](research/discord-capabilities.md). The working implementation stance is:

| Feature | Officially supported? | Required authority | V1 status |
| --- | --- | --- | --- |
| Pika user identity | Yes | User OAuth consent | Planned |
| Server installation | Yes | Server administrator consent | Planned |
| Scoped event monitoring | Yes, through installed bot and valid intents | Bot channel permission plus required intent | Planned after connection foundation |
| Broad message-content search | Conditional | Message Content privileged intent and policy-consistent purpose | Deferred pending review |
| Community directory | Yes, for opt-in listings | Community operator submission/connection | Planned |
| Member enumeration/export | Technically conditional but policy-sensitive | Privileged Members intent | Excluded from V1 |
| Automated contact/outreach | Policy constrained | Individual explicit permission | Excluded from V1 |
| Data scraping through user sessions | No | N/A | Prohibited |
