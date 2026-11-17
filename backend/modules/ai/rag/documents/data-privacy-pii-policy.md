---
title: Data Privacy and PII Handling Policy
access: public
category: policy
---

# Data Privacy and PII Handling Policy

## 1. What counts as personal data (PII)
Personally identifiable information includes: full name together with other details, email address, phone number, postal address, government identifiers (SSN, Aadhaar, PAN, passport number), payment card numbers, bank account numbers, passwords, API keys and access tokens.

## 2. What we collect
We collect the minimum data needed to run the marketplace: account details, delivery address, order history, product reviews and messages between buyers and sellers. Passwords are stored only as salted hashes.

## 3. How the AI assistant handles PII
- **Masking before processing.** Before a message reaches the language model, our system detects emails, phone numbers, card numbers, government identifiers and secrets and replaces them with placeholders such as [EMAIL_1] or [CARD_1].
- **Sensitive values are never restored.** Card numbers, government identifiers and secrets are never put back into a reply and are never stored.
- **Logs contain masked text only.** Audit logs record the masked version of every request together with the type and count of PII found, not the values.
- **Access follows your role.** The assistant only returns data your role may see. Customers see their own orders. Sellers see sales data about their own products. Administrators see platform-wide analytics.

## 4. Data retention
- Order records are kept for 7 years for accounting and legal reasons.
- AI conversation history is kept for 30 days and then deleted automatically.
- AI audit logs are kept for 90 days.

## 5. Your rights
You may ask to access, correct, export or delete your personal data. Deleting an account removes the profile but keeps anonymised order records that the law requires us to keep. Send requests to the privacy team through the support page.

## 6. Sharing
We share personal data only with: carriers (name, address, phone for delivery), payment processors, and sellers (only the order and delivery details needed to fulfil your order). We never sell personal data.

## 7. Security incidents
If personal data is exposed, affected users are notified within 72 hours of confirmation, as required by common privacy regulations.
