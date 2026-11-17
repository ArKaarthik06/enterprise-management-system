---
title: Administrator Handbook (Internal)
access: admin
category: internal
---

# Administrator Handbook (Internal)

Confidential. For users with the "root_admin" role only.

## 1. Roles and permissions
| Role | Main permissions |
|---|---|
| root_admin | Approve sellers, view global analytics and inventory, view all messages, run AI document ingestion, view the AI audit log |
| product_owner | Manage own products and inventory, view own analytics |
| customer | Place and view own orders, write reviews |

## 2. Approving sellers
1. Open the pending seller list.
2. Check the business name and description for policy problems (see the Prohibited Items Policy).
3. Approve to set the status to "active", or reject and add a reason in the message thread.
Never approve accounts that use a free email provider together with a luxury-brand business name without asking for documents.

## 3. Refund approval limits
- Support agents may approve refunds up to $200.
- Refunds from $200 to $2,000 need a root administrator.
- Refunds above $2,000 need two root administrators and a note in the order record.

## 4. Fraud signals
Escalate when you see: many orders from one address with different accounts, repeated failed orders for the same high-value item, orders with delivery cities that do not match the billing country, and rapid account creation. Hold the orders and notify the trust team.

## 5. Incident response for the AI assistant
- Open the AI audit view and filter blocked requests.
- A spike of blocked "prompt injection" attempts from one user means: rate limit the user, then suspend the account after review.
- If the assistant ever shows data it should not, switch the AI feature off with the environment variable AI_ENABLED=false and tell the security lead.
- Never paste real customer data into the assistant while investigating. Use order identifiers only.

## 6. Analytics routines
- Review top-selling products and low-stock lists every Monday.
- Compare weekly revenue with the previous week. A drop of more than 20% needs a short written explanation.
- Delivery city concentration above 40% in one city is a logistics risk and should be reported.

## 7. Data retention tasks
Remove AI conversations older than 30 days and audit logs older than 90 days. This is done automatically by database expiry rules but must be verified once per quarter.
