# Privacy Policy

**Effective Date**: 2026-06-20
**Last Updated**: 2026-06-20

> ⚠️ **This document has not yet been reviewed by legal counsel. Please complete such review before launch.**

SentenceEnd Inc ("we," "us," or "our") operates Amux Studio ("the Service"). This Policy explains what information we collect, how we use it, who we share it with, and how you can manage it.

Please read this Policy in full before using the Service. If you do not agree with this Policy, please stop using the Service.

---

## 1. Scope

This Policy applies to all features you use through the web client and desktop client of Amux Studio, including image generation, video generation, asset management, templates and the Gallery, membership, and credits.

This Policy does not apply to third-party websites or services linked from the Service; those services are governed by their own privacy policies.

---

## 2. What Information We Collect, and Why

### 2.1 Information You Provide Directly

**Account Registration**
- **Email address** (required) — used as your account identifier, login credential, and the address for password resets and security verification
- **Username** (required) — the unique identifier for your account
- **Password** (required for email registration) — we **do not store your password in plaintext**; we store only the result of a one-way bcrypt hash, which cannot be reversed

**Third-Party Login**

If you choose to log in with a Google, GitHub, or Apple account, we receive from the corresponding platform: your display name, email address, avatar link, and an authorization token used to maintain your login session. Authorization tokens are stored encrypted with AES-256-GCM.

We **do not** obtain your friend relationships, private messages, posts, or other content on these platforms.

**Profile Information (all optional)**

Nickname, avatar, bio, one-line tagline, location, social media links (X / Instagram / YouTube / TikTok), and interface language preference. You provide this information voluntarily, and some of it may be shown to other users when you participate in public features such as the Gallery.

### 2.2 Information Generated When You Use the Service

**Creative Content**
- The prompts you enter
- Reference images and asset files you upload
- Generated images and videos
- Conversations with the AI assistant
- Documents you upload for knowledge retrieval and their vectorized results

This content is used to: deliver generation results to you, save and retrieve items in your asset library, display your work in the Gallery when you submit it, and support technical troubleshooting when a generation fails.

**Generation Task Records**

Each generation task records: the model used, parameters, task status, duration, and failure reasons (including error information returned by upstream services). These records are used for troubleshooting, billing reconciliation, and customer support.

**Transaction Information**

Order number, product name, amount, currency, payment status, and credit transaction history. Callback data returned by payment channels is retained for reconciliation.

### 2.3 Information We Collect Automatically

For account security and abuse-prevention purposes, we record:

- **IP address and device identifiers at registration**
- **IP address and browser identifier (User-Agent) of login sessions**
- **Most recent login time**
- **Risk-control signals** (unusual logins, abnormal call frequency, etc.)

This information is used only for security auditing, anomaly detection, and rate limiting, and is not used for user profiling or advertising.

---

## 3. Cookies and Local Storage

**We use only technically necessary storage. We do not use advertising tracking cookies, and we have not integrated any third-party analytics or advertising services.**

We write the following to your browser:

| Name | Type | Purpose | Retention |
|---|---|---|---|
| `NEXT_LOCALE` | Cookie | Remembers your chosen interface language | 1 year |
| `sidebar_state` | Cookie | Remembers the sidebar's expanded/collapsed state | 7 days |
| Login credentials | Local Storage | Maintains your login session so you don't need to log in again for every action | Until logout or credential expiration |
| Theme, visitor identifier | Local Storage | Remembers dark/light mode; counts content views (excludes IP) | Until you clear your browser data |

All of the above are either necessary for the Service to function or directly implement a preference you selected. You may clear them at any time via your browser settings, but clearing login credentials will log you out.

**A note on shared devices**: Login credentials are stored in your browser's local storage. Please be sure to click "Log Out" after using the Service on a public or shared device.

---

## 4. Who We Share Information With

We **do not sell** your personal information. Below is the sharing necessary to deliver the Service's functionality:

### 4.1 AI Model Providers

When you initiate a generation task, we send **the prompt you entered and any reference images you uploaded** to the corresponding model provider, which performs the inference and returns the result. The providers involved depend on the model you select, and may currently include: Volcano Engine (Doubao / Seedance), the Amux Model Gateway, PoYo, and third-party models accessed through the above gateways (such as Gemini, MiniMax, OpenAI, Veo, Wan, Grok, and others).

**We do not pass your account identifier, email address, or any other identity information to model providers** — they receive only the content itself.

### 4.2 Payment Providers

We use Stripe to process payments. When you place an order, we pass to Stripe: the order number, product name, amount, and currency.

**We do not pass your email, name, or address to Stripe.** Your card information is collected and processed directly by Stripe; our servers **never access or store any card numbers or payment credentials**.

### 4.3 Cloud Storage Providers

Assets you upload and images/videos you generate are stored on Cloudflare R2 object storage.

### 4.4 Email Service Providers

Account verification, password reset, and security verification code emails are sent through a third-party SMTP service, which has access to your email address and the content of these emails.

### 4.5 Third-Party Login Platforms

If you log in with a third-party account, the login process interacts with the corresponding platform (Google / GitHub / Apple).

### 4.6 Legal Requirements

We may disclose relevant information when required by law or regulation, when required by a judicial or administrative authority through legally prescribed procedures, or when necessary to protect the significant legitimate rights and interests of others.

---

## 5. Public Display of Content

**Your creations are private by default.**

Only when you actively choose to "Submit to Gallery" does content enter the public review process. Once a submission is approved by an administrator, the following information becomes visible to all visitors: the work's image or video, the prompt used to generate it, the model name, size parameters, and your nickname and avatar.

Before submitting, please confirm that you are willing to make this information public — **your prompt will be displayed publicly alongside the work**.

You may withdraw a published submission at any time. Once withdrawn, the work will no longer be displayed publicly.

---

## 6. How We Protect Information

- Passwords are stored using salted one-way bcrypt hashing with a cost factor of 12
- Third-party login tokens are stored encrypted with AES-256-GCM
- HTTPS is enforced site-wide, with HSTS enabled
- Administrative functions are governed by role-based access control, and administrative actions are logged for audit
- Cross-origin access is restricted to explicitly configured origins

Despite these measures, **no internet environment is absolutely secure**. Please safeguard your password and avoid reusing it across multiple sites.

In the event of a personal information breach, we will promptly notify affected users and report to regulators as required by applicable law.

---

## 7. How Long We Retain Information

| Data Type | Retention Period |
|---|---|
| Account and profile information | Until you delete your account |
| Creative content and assets | Until you delete them or delete your account |
| Generation task records (successful) | 30 days |
| Generation task records (failed / expired) | 90 days |
| In-app task notifications | 30 days |
| Email verification codes, security verification credentials | Cleared shortly after expiration |
| Rate-limiting counters | 2 days |
| Orders and transaction records | Retained for the period required by applicable financial and tax regulations |

---

## 8. Your Rights

### 8.1 Access and Correction

You may view and edit your nickname, avatar, bio, and other information on your profile page at any time. Changing your email requires security verification.

### 8.2 Deleting Content

You may delete files in your asset library, generation records, and conversations at any time.

### 8.3 Deleting Your Account

You may delete your account from your account settings. Deletion requires verification via an email code and manual entry of your username to confirm, to prevent accidental action.

**What happens after deletion:**

*Permanently deleted:* login sessions, third-party account links, authorization tokens, likes and favorites records, pending uploads, share links, and security verification credentials.

*Anonymized:* Your account will be marked as deleted; personal information such as your username, email, avatar, bio, social links, and registration IP and device identifiers will be cleared or replaced with meaningless placeholder values. Works you previously published to the Gallery will be displayed as authored by a "deleted user."

*Retained:* order records, payment callbacks, credit transaction history, and risk-control records. This data remains associated with your account ID and is retained to satisfy statutory retention obligations related to finance, tax, and fraud prevention; it cannot be removed in response to a deletion request.

**Account deletion is irreversible.** Please export any work you wish to keep before proceeding.

### 8.4 Exercising Your Rights

To exercise the rights above, or for any questions or complaints about this Policy, please contact **studio@amux.ai**. We will respond within a reasonable time after receiving your request.

### 8.5 Additional Rights for U.S. State Residents

If you are a resident of California, or of another state with comprehensive privacy legislation in effect (including Virginia, Colorado, Connecticut, and Utah), you have the following rights in addition to those described above.

**We do not "sell" or "share" your personal information.**

Under the California Consumer Privacy Act (CCPA, as amended by the CPRA), "sell" means disclosing personal information to a third party for monetary or other valuable consideration, and "share" specifically means disclosing personal information for **cross-context behavioral advertising**.

**We do neither.** The Service does not integrate any advertising network, cross-site tracking, or third-party analytics service. Accordingly, we do not offer a "Do Not Sell or Share My Personal Information" option — there is no such activity for you to opt out of.

The only disclosures we make to third parties are to the service providers listed in Section 4 of this Policy (model inference, payment, cloud storage, email, third-party login). These disclosures are necessary to provide the Service to you and do not constitute a "sale" or "share."

**Your rights:**

- **Right to know** — to request disclosure of the categories of personal information we collect, their sources, the purposes of use, and the categories of recipients
- **Right to access** — to obtain a copy of the personal information we hold about you
- **Right to correct** — to request correction of inaccurate personal information
- **Right to delete** — to request deletion of the personal information we have collected (except where retention is required by law; see Section 8.3)
- **Right to limit the use of sensitive personal information** — see below
- **Right to non-discrimination** — we will **not** deny you service, charge you a different price, provide a different level of service quality, or retaliate against you in any way for exercising any of these rights

**Regarding sensitive personal information**

Your account login credentials (email address and password) constitute sensitive personal information as defined by the CPRA. We use them **solely for account authentication, login, and security protection**, and not to infer your characteristics, preferences, or identity attributes. Because our use of sensitive personal information does not exceed the purposes permitted by law, there is no additional use to be limited under the CPRA's "right to limit" in this context.

**How to exercise these rights**

Send an email to **studio@amux.ai** stating the right you wish to exercise and your state of residence.

- We will respond within **45 days** of receiving a **verifiable request**; where reasonably necessary, we may extend this by an additional 45 days and will inform you of the reason for the extension within the original period
- To protect your account, we will first verify the identity of the requester, typically by confirming through the email address associated with your account
- We will not charge you a fee for making a request

**Authorized agents**

You may authorize another person to submit a request on your behalf. We may require the agent to provide written authorization signed by you, and we may require you to confirm the authorization directly with us.

---

## 9. Minors

**The Service is intended only for users aged 18 and older.** You must confirm you meet this age requirement when registering.

We do not knowingly collect personal information from minors. If we learn that we have collected information from a minor without our knowledge, we will delete it as soon as possible.

If you are a guardian and discover that a minor in your care has used the Service without your consent, please contact **studio@amux.ai**, and we will assist you.

---

## 10. Updates to This Policy

We may update this Policy in response to feature changes or legal requirements. Material changes (such as new data uses or new sharing parties) will be communicated via in-app notice or email.

Your continued use of the Service after a change takes effect constitutes acceptance of the updated Policy.

---

## 11. Contact Us

For any questions, comments, or complaints about this Policy:

**Email**: studio@amux.ai
**Operating Entity**: SentenceEnd Inc
**Address**: 30 N Gould St Ste R, Sheridan, WY 82801, USA
