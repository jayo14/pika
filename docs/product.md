# Pika Product Requirements Document

## Product definition

Pika is a **consent-based Discord community intelligence workspace**. It helps an authorized community operator or workspace member find a small number of useful, legitimately available conversations and community changes, understand why each item is relevant, and save it for a human follow-up.

> **Product principle:** show users fewer, better things—not more Discord data.

Pika is not a Discord scraper, a user-session automation tool, a member-export tool for arbitrary joined servers, an autonomous outreach system, or a system for profiling people. The product only processes data made available through official Discord mechanisms and only for the disclosed, authorized purpose.[1] [2]

## Strong initial customer segments

| Segment | Job Pika is hired to do | Initial value moment |
| --- | --- | --- |
| Community operators | Notice meaningful activity in their own opted-in community without reading every channel | A rule surfaces a recent discussion from an allowed channel with a plain-language reason. |
| SaaS founders with an authorized community | Identify recurring product questions and feedback in their installed community | Pika groups a small set of messages under a configured problem topic. |
| Agencies and freelancers who operate an opted-in community | Notice explicit requests and project discussions in the communities where they are authorized operators | A monitor surfaces an explicit request and lets the user save it with a private note. |
| Coaches and educators who operate a community | Find recurring learner questions and demand themes | A saved signal shows a verified excerpt, topic tags, and the monitor rule that matched it. |

The initial target is **the server administrator who authorizes Pika**. Prospecting across arbitrary communities where a customer is merely a member is excluded from V1 because it is not an appropriate or dependable compliance boundary.

## Jobs to be done

The primary job is: *“When activity is happening in my authorized community, help me notice the small number of conversations I should review before they get buried.”*

Secondary jobs are: *“Let me create a narrow monitoring rule without technical setup,”* *“show me why a surfaced item matches,”* and *“let me keep a short private list with notes and statuses.”*

## V1 workflow

```text
Create Pika workspace
        ↓
Install Pika bot into an administrator-authorized Discord server
        ↓
Choose allowed channels and a retention policy
        ↓
Create a monitor (topic, keyword, or event rule)
        ↓
Receive an authorized event
        ↓
Apply deterministic matching and optional probabilistic classification
        ↓
Show an explainable signal in Pika
        ↓
Save, tag, note, or archive the item
```

## V1 requirements

| Area | Deliver in V1 | Explicit boundary |
| --- | --- | --- |
| Authentication | Pika account, workspace, secure session, and Discord OAuth hand-off | Never collect Discord passwords or raw user tokens. |
| Connection | Install bot with explicit admin consent; display connection and channel scope | Do not treat a regular user’s guild membership as authorization to ingest. |
| Discovery | Opt-in directory of community-submitted or administrator-connected listings | No crawling, hidden-data collection, or arbitrary server enumeration. |
| Monitoring | Configurable keyword/topic/channel/event monitors with priority and cooldown | No automated direct messaging or spam. |
| Search | Full-text search across retained, authorized events; saved searches | No search over data Pika is not authorized to retain. |
| Signals | Explainable rule-based results first; optional classification marked as probabilistic | No opaque person scoring or “lead probability” claims. |
| Workspace | Save, tag, note, status, and archive signals/conversations | Not a full CRM. |
| Alerts | In-app notification feed and digest preferences | No alert per raw event; no default email/push noise. |
| Privacy | Channel scope, retention configuration, deletion/revocation flow, audit entries | No data broker, advertising, or model-training use of Discord message content. |

## Non-goals for V1

Pika will not ship bulk member export, individual presence tracking, normal-user-session monitoring, automated contact or outreach, cross-community people profiling, full CRM workflows, payment processing, or multi-platform ingestion in its first release.

## Success criteria

Pika V1 is useful when an administrator can configure one monitor, see a legitimate matching event, understand the match explanation, and save it with a human-owned follow-up state. The key metric is **time to first useful saved signal**, not volume of events collected.

## Sources

[1] [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)

[2] [Discord Developer Terms of Service](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service)
