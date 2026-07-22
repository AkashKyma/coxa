# PAP-471: Gap One

These Are the Gaps Which is Provide My Our Team do Deeply The repo And Fix it If any things Is

\## 1. Executive Summary

Coxa is a three-surface football-club SaaS platform: a club admin console (\*\*club.coxa.live\*\*), a fan-facing mobile/web portal (\*\*fan.coxa.live\*\*), and a B2B marketing-intelligence product sold to clubs (\*\*fanbox.coxa.live\*\*, "FanBox"). All three surfaces share a common architectural ambition — an event-driven customer data platform (CDP) with computed traits, machine-learning propensity scores, and a Next Best Offer (NBO) engine — but all three surfaces stop short of being operationally complete. Each independent audit converged on the same verdict from a different angle: the data model is ahead of the market in concept, but the delivery, compliance, and configuration layers that turn that data model into revenue and retention are largely missing or broken.

\*\*Overall maturity scores (from each audit):\*\*

\| Surface | Maturity Score | Source |

\|---|---|---|

\| club.coxa.live (Admin) | \*\*\~35/100\*\* (vs. \~85/100 industry benchmark) | \[coxa\_platform\_gap\_report.md §Maturity Assessment]\(../workspace/coxa\_platform\_gap\_report.md) |

\| fan.coxa.live (Fan Portal) | \*\*1.8/10\*\* | \[coxa\_fan\_portal\_gap\_analysis.md §8 Summary Scorecard]\(../workspace/coxa\_fan\_portal\_gap\_analysis.md) |

\| fanbox.coxa.live (FanBox B2B) | \*\*2.8/10\*\* | \[fanbox\_gap\_analysis.md §10 Summary Scorecard]\(../workspace/fanbox\_gap\_analysis.md) |

\| Prior QA/Security pass | "\*\*Not production-ready\*\*" verdict | \[coxa\_full\_platform\_test\_report.md]\(../workspace/coxa\_full\_platform\_test\_report.md) |

\*\*Verdict:\*\* Coxa has built a genuinely sophisticated data backbone — event stream → computed fan traits → segments → ML propensity scores → Next Best Offer — that is architecturally comparable to what StellarAlgo, mParticle, or Segment offer at the identity-and-scoring layer. However, none of the three surfaces can currently *\*act\** on that intelligence: there is no email, SMS, push, or WhatsApp channel anywhere in the platform, the shared journey/automation engine (Tracardi) is offline, compliance tooling for LGPD is completely absent on both the admin and fan side, and 18 fan-facing routes render as blank pages. The platform is best understood today as a well-instrumented transactional backbone (POS, F\&B, ticketing, membership billing) wrapped around an analytically promising but operationally inert marketing layer. Against mature vendors — Braze, Salesforce Data Cloud, Iterable, Klaviyo, KORE/Two Circles, StellarAlgo — Coxa currently scores in the 20–35% range on core CDP/marketing-automation capability and near 0% on compliance and channel breadth, while it holds a defensible, product-differentiating lead only in football-domain modeling (sector-based ticketing, Sócio tiering, QR redemption, fan-score composition).

\*\*The 5 issues that block production shipping:\*\*

1\. \*\*No communication channel exists anywhere in the platform.\*\* No email, SMS, push, or WhatsApp sending capability on club.coxa.live, fan.coxa.live, or fanbox.coxa.live. Segments, NBOs, and campaigns can be *\*built\** but never *\*delivered\** (\[coxa\_platform\_gap\_report.md §21]\(../workspace/coxa\_platform\_gap\_report.md); \[fanbox\_gap\_analysis.md §2.10]\(../workspace/fanbox\_gap\_analysis.md)).

2\. \*\*The shared journey/automation engine (Tracardi) is offline\*\* on both club.coxa.live and fanbox.coxa.live, and while it was reachable it displayed \*\*admin credentials in plaintext in the UI\*\* — a critical security vulnerability confirmed independently by the FanBox audit and the prior QA/security report (\[fanbox\_gap\_analysis.md §2.8]\(../workspace/fanbox\_gap\_analysis.md); \[coxa\_full\_platform\_test\_report.md SEC-P0-1]\(../workspace/coxa\_full\_platform\_test\_report.md)).

3\. \*\*Zero LGPD/GDPR compliance tooling exists on any surface.\*\* No consent capture, no data-subject-request workflow, no right-to-erasure, no audit trail — a direct legal liability given Brazil's ANPD enforcement of LGPD (\[coxa\_fan\_portal\_gap\_analysis.md §5 item 4]\(../workspace/coxa\_fan\_portal\_gap\_analysis.md); \[fanbox\_gap\_analysis.md §8.2]\(../workspace/fanbox\_gap\_analysis.md); \[industry\_benchmark.md §4.1]\(../workspace/industry\_benchmark.md)).

4\. \*\*Five unauthenticated production API endpoints\*\* on \`api.coxa.live\` leak tenant catalog, pricing, and membership data with no auth header, plus publicly indexed API docs — a P0 finding from the prior security pass, unresolved as of this audit (\[coxa\_full\_platform\_test\_report.md SEC-P0-2]\(../workspace/coxa\_full\_platform\_test\_report.md)).

5\. \*\*18 fan-portal routes render as completely blank pages\*\* (\`/profile/edit\`, \`/settings\`, \`/notifications\`, \`/news\`, \`/matches\`, \`/players\`, \`/videos\`, \`/predictions\`, \`/polls\`, \`/votes\`, \`/community\`, \`/friends\`, \`/support\`, \`/help\`, \`/faq\`, \`/consent\`, \`/privacy\`, \`/language\`) — meaning the primary consumer-facing product is materially incomplete, not just missing polish (\[coxa\_fan\_portal\_gap\_analysis.md §2]\(../workspace/coxa\_fan\_portal\_gap\_analysis.md)).

\---

\## 2. Platform Architecture Overview

\### 2.1 What Coxa Is

Coxa is a vertical SaaS suite purpose-built for football clubs, structured as three distinct but data-linked surfaces:

\- \*\*club.coxa.live\*\* — the club-operations admin console. Covers point-of-sale retail, food & beverage, ticketing/gate operations, a first-generation CDP (event stream, segments, Customer 360), a Next Best Offer personalization engine, loyalty program administration, and Sócio (membership) plan management. 30 modules were audited end-to-end (\[coxa\_platform\_gap\_report.md Full Module Inventory]\(../workspace/coxa\_platform\_gap\_report.md)).

\- \*\*fan.coxa.live\*\* — the fan-facing mobile/web portal. Six working bottom-tab routes (Home, Tickets, Shop, Rewards, Sócio, Profile) plus a wallet screen, against 18 additional routes that exist in the navigation model but render blank (\[coxa\_fan\_portal\_gap\_analysis.md §1–2]\(../workspace/coxa\_fan\_portal\_gap\_analysis.md)).

\- \*\*fanbox.coxa.live ("FanBox")\*\* — the B2B marketing-intelligence product Coxa sells to clubs as its own CDP/campaign layer, benchmarked directly against Salesforce Marketing Cloud/Data Cloud, Braze, Iterable, mParticle/Segment, Bloomreach, Klaviyo, Zendesk, KORE Software, StellarAlgo, Two Circles, Deltatre DIVA, and Genius Sports FanHub (\[fanbox\_gap\_analysis.md header]\(../workspace/fanbox\_gap\_analysis.md)).

\### 2.2 Data Model Strengths

Across all three surfaces, the underlying data architecture is Coxa's strongest asset:

\- \*\*Event-driven CDP.\*\* club.coxa.live exposes a real-time domain event stream (\`/cdp/events\`) filterable by Sales, Loyalty, Inventory, Registration, and Returns, feeding downstream computed traits (\[coxa\_platform\_gap\_report.md §10]\(../workspace/coxa\_platform\_gap\_report.md)).

\- \*\*Computed fan traits.\*\* Customer 360 auto-calculates \~14 traits per fan (is\_annual\_member, is\_high\_value\_retail, is\_inactive, months\_as\_member, total\_retail\_spend\_cents, etc.) without manual configuration (\[coxa\_platform\_gap\_report.md §12]\(../workspace/coxa\_platform\_gap\_report.md)).

\- \*\*Next Best Offer (NBO) engine.\*\* A segment-matched, single-offer-per-fan recommendation engine exists on both club.coxa.live and is surfaced to fans, with an offer catalog supporting 6 offer types (Discount %, Discount R$, Bundle, Bonus points, Free shipping, Voucher) (\[coxa\_platform\_gap\_report.md §14–15]\(../workspace/coxa\_platform\_gap\_report.md)).

\- \*\*ML propensity scores.\*\* FanBox's Segments & Audiences module ships pre-built ML fields: Churn Risk Score (0–1), Ticket Propensity (0–1), Retail Propensity (0–1), Next Best Channel, Fan Score (with 6 sub-scores: Attendance, Tenure, Spending, Referral, Engagement, Donations) (\[fanbox\_gap\_analysis.md §2.7]\(../workspace/fanbox\_gap\_analysis.md)). This is functionally equivalent to the predictive layer StellarAlgo and mParticle Cortex offer (\[industry\_benchmark.md §1.2, §2.4]\(../workspace/industry\_benchmark.md)).

\- \*\*Rich segmentation operators (FanBox only).\*\* FanBox's segment builder supports a genuinely mature operator set — \`\=, !\=, \<, >, \<\=, >\=, contains, begins with, ends with, is null, in, between\`, etc. — that exceeds what club.coxa.live's CDP Segments module offers (single-condition only) (\[fanbox\_gap\_analysis.md §2.7]\(../workspace/fanbox\_gap\_analysis.md); \[coxa\_platform\_gap\_report.md §11]\(../workspace/coxa\_platform\_gap\_report.md)).

\- \*\*Football-domain modeling.\*\* Sector-based ticketing, QR gate-pass redemption, Sócio membership priority ranking, and a composite Fan Score (attendance + tenure + spending + referral + engagement + donations) are genuinely differentiated versus generic retail CDPs — none of Braze, Salesforce, Iterable, mParticle, Bloomreach, or Klaviyo offer sports-specific modeling out of the box (\[fanbox\_gap\_analysis.md §6 Competitor Feature Comparison Matrix, Sports-Specific row]\(../workspace/fanbox\_gap\_analysis.md)).

\### 2.3 Where the Architecture Ends

The sophistication stops precisely at the boundary between *\*knowing\** and *\*acting\**:

\- \*\*Channels.\*\* There is no email, SMS, push, WhatsApp, in-app message, or web push send capability on any surface. FanBox's Campaign Wizard lists Email/SMS/Push as *\*type options\** but the email composer is a raw HTML textarea with no sending infrastructure visibly configured (no sender domain, no ESP integration) (\[fanbox\_gap\_analysis.md §2.10]\(../workspace/fanbox\_gap\_analysis.md)).

\- \*\*Compliance.\*\* LGPD/GDPR tooling — consent capture, DSR workflow, right-to-erasure, audit trail, suppression lists — scores 0/100 on club.coxa.live and 1/10 on FanBox, and the fan-portal consent widget is a placeholder reading "consent module not enabled" (\[coxa\_platform\_gap\_report.md Maturity Assessment table]\(../workspace/coxa\_platform\_gap\_report.md); \[fanbox\_gap\_analysis.md §10]\(../workspace/fanbox\_gap\_analysis.md); \[coxa\_fan\_portal\_gap\_analysis.md §PROFILE]\(../workspace/coxa\_fan\_portal\_gap\_analysis.md)).

\- \*\*Integrations.\*\* \`/integrations\`, \`/api-keys\`, and \`/webhooks\` all 404 on club.coxa.live. FanBox has no integration marketplace, no public REST API documentation, and no webhook receiver (\[coxa\_platform\_gap\_report.md Full Module Inventory]\(../workspace/coxa\_platform\_gap\_report.md); \[fanbox\_gap\_analysis.md §8.5]\(../workspace/fanbox\_gap\_analysis.md)).

\---

\## 3. Gap Analysis by Surface

\### 3.1 club.coxa.live (Admin) — Maturity \~35/100

The admin console audit covered 30 modules end-to-end (\[coxa\_platform\_gap\_report.md Full Module Inventory]\(../workspace/coxa\_platform\_gap\_report.md)). Present modules span Dashboard, Roles, Users, six Retail sub-modules, four F\&B sub-modules, four Ticketing sub-modules, four CDP sub-modules, two Personalization sub-modules, Loyalty, three Membership sub-modules, Analytics, and a placeholder Settings page. Ten additional routes (\`/billing\`, \`/api-keys\`, \`/webhooks\`, \`/integrations\`, \`/audit-log\`, \`/campaigns\`, \`/journeys\`, \`/content\`, \`/reports\`, \`/help\`) return 404.

\#### Full module inventory

\| Module | URL Path | Status |

\|---|---|---|

\| Overview / Dashboard | \`/\` | Present |

\| Club Intelligence (Analytics) | \`/analytics\` | Present |

\| Role Registry | \`/roles\` | Present (30 fixed presets, read-only) |

\| Staff & Users | \`/users\` | Present |

\| Retail Products | \`/retail/products\` | Present |

\| Retail Categories | \`/retail/categories\` | Present |

\| Retail Locations | \`/retail/locations\` | Present |

\| Retail Stock | \`/retail/stock\` | Present |

\| Retail Transfers | \`/retail/transfers\` | Present |

\| Retail Sales | \`/retail/sales\` | Present |

\| Retail Returns | \`/retail/returns\` | Present |

\| Retail QR Redemption | \`/retail/qr-redeem\` | Present |

\| F\&B Products | \`/fnb/products\` | Present |

\| F\&B Food Inventory | \`/fnb/inventory\` | Present |

\| F\&B Sales | \`/fnb/sales\` | Present |

\| F\&B QR Redemption | \`/fnb/qr-redeem\` | Present |

\| Ticketing Events | \`/ticketing/events\` | Present |

\| Ticketing Venues | \`/ticketing/venues\` | Present |

\| Ticketing Check-in Dashboard | \`/ticketing/check-in\` | Present |

\| Ticketing Support & Override | \`/ticketing/support\` | Present |

\| CDP Event Stream | \`/cdp/events\` | Present |

\| CDP Segments | \`/cdp/segments\` | Present |

\| Customer 360 | \`/cdp/customer-360\` | Present (read-only) |

\| Automation Workflows | \`/cdp/workflows\` | Present (Tracardi-embedded, \*\*OFFLINE\*\*) |

\| Personalization Overview & NBO | \`/personalization\` | Present |

\| Personalization Offers | \`/personalization/offers\` | Present |

\| Loyalty Program Rules | \`/loyalty\` | Present (tiers hardcoded) |

\| Membership Plans | \`/membership/plans\` | Present |

\| Membership Members | \`/membership/members\` | Present |

\| Membership Priority Ranking | \`/membership/priority\` | Present |

\| Settings | \`/settings\` | Present (\*\*PLACEHOLDER ONLY\*\*) |

\| *\*(missing)\** | \`/billing\` | 404 |

\| *\*(missing)\** | \`/api-keys\` | 404 |

\| *\*(missing)\** | \`/webhooks\` | 404 |

\| *\*(missing)\** | \`/integrations\` | 404 |

\| *\*(missing)\** | \`/audit-log\` | 404 |

\| *\*(missing)\** | \`/campaigns\` | 404 |

\| *\*(missing)\** | \`/journeys\` | 404 |

\| *\*(missing)\** | \`/content\` | 404 |

\| *\*(missing)\** | \`/reports\` | 404 |

\| *\*(missing)\** | \`/help\` | 404 |

Source: \[coxa\_platform\_gap\_report.md Full Module Inventory]\(../workspace/coxa\_platform\_gap\_report.md).
