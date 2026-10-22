# Multi-Tenant Business Setup & 5-Seat Trial System (Manager, Team Leader, Sales Agents)

Transform TOZ Flow CRM into a multi-tenant B2B platform where new businesses can register their own dedicated workspace with an instant 5-seat trial (1 Manager, 1 Team Leader, 3 Sales Agents), directly provision team members, and manage leads in strict isolation.

### User Review & Critical Decisions

> [!IMPORTANT]
> The clarifying questions were skipped; recommended defaults have been adopted to guarantee zero friction and rapid business onboarding:
> 1. **Self-Serve Business Registration**: New business founders can launch a workspace directly from the landing page or on initial login without waiting for manual SuperAdmin approval.
> 2. **Fixed 5-Seat Trial Quota**: Workspaces are initialized with a 5-seat quota configured as 1 Manager (Founder), 1 Team Leader, and 3 Sales Agents.
> 3. **Direct Team Provisioning**: Managers can create team member logins with email and initial password directly inside the Team Manager, allowing agents to log in immediately.
> 4. **Multi-Tenant Data Isolation**: All leads, orders, inventory, notifications, and logs are strictly scoped by `orgId`.

---

### 1. Overview & Core Concept

- **What It Does**: Enables entrepreneurs and health brand founders to set up a dedicated CRM instance for their company. Each new business gets a trial tier with 5 seats configured for high-velocity sales operations:
  - **1 Business Manager (Admin)**: Full control over the business workspace, team invites, analytics, inventory, and settings.
  - **1 Team Leader**: Lead distribution/round-robin manager, verification queue supervisor, and agent performance monitor.
  - **3 Sales Agents**: Focused calling workspace to manage assigned leads, update call statuses, and confirm orders.
- **Target Audience**: Nutraceutical and direct-to-consumer health brands, affiliate networks, and tele-calling agencies who need a turnkey CRM for their sales teams.
- **Key Value**: Instant setup with zero technical barrier; businesses can sign up, create logins for their 4 team members within 2 minutes, and start calling leads immediately with full privacy.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Business Signup*: Founder visits the landing page, switches to the "Register Business" tab, enters Business Name, Owner Name, Work Email, and Password.
  2. *Workspace Initialization*: The account is instantly provisioned in Firestore with a dedicated `orgId`, initializing the 5-Seat Trial subscription, setting the founder as Manager (`role: 'Manager'`), and redirecting directly to the workspace dashboard.
  3. *Team Roster Setup (Team Manager)*: The Manager opens the "Human Resources / Team" tab. A visual **Trial Seat Usage Meter** displays available slots:
     - 👑 **1x Manager (Active)**
     - 🛡️ **1x Team Leader Slot (Available / Provisioned)**
     - 🎧 **3x Sales Agent Slots (Available / Provisioned)**
  4. *Direct Member Creation*: Manager clicks "Add Team Member", selects role (`Team Leader` or `Sales Agent`), enters name, email, and password. The system provisions the login credentials and presents a copyable "Team Access Card" for immediate distribution.
  5. *Agent Experience*: When the Team Leader or Sales Agent logs in, they are immediately placed into their business workspace without pending waitlists. Agents only see leads assigned to them; Team Leaders see the whole team's pipeline and queue.

- **Visual Theme & Spatial Hierarchy**:
  - Consistent with TOZ Flow's executive dark/light styling (`#0F172A` slate dark foundation, emerald `#059669` accents, crisp tabular numerals).
  - Seat Quota bar built with high-density tabular typography and clear slot indicators (e.g. `1/1 Manager`, `1/1 Team Leader`, `2/3 Agents`).
  - Modal with instant credential preview card and "Copy Login Details" button.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Provisioning vs Email Invite Links**
  - *Chosen Approach*: Direct account creation with temporary password from the Manager UI (via a secure backend proxy endpoint using Firebase Admin SDK or client authentication secondary flow).
  - *Why*: In tele-sales and tele-calling agencies, managers assign logins directly to agents on shift; email invites often end up in spam or cause friction.
  - *Alternative Considered*: Magic email invitation links (slower adoption and requires SMTP deliverability).

- **Decision 2: Role Model Hierarchy**
  - *Chosen Approach*: Support `TeamLeader` role alongside `Manager` and `Sales` / `Agent`.
    - `Manager`: Full workspace admin (settings, billing, team, all leads, inventory).
    - `TeamLeader`: Lead assignments, verification approvals, agent activity monitoring, reports.
    - `Sales` / `Agent`: Restricted view to assigned leads, calling logs, order confirmation.
  - *Why*: Directly fulfills the user's explicit operational structure (`first manager, dusra team leader, aur baaki sales agent`).

- **Decision 3: Multi-Tenant Data Enforcement**
  - *Chosen Approach*: Every read and write query in `dataService` strictly requires `orgId` matching `user.orgId` (unless root SuperAdmin).
  - *Why*: Guarantees that business A cannot accidentally read or write business B's leads, customers, or financial data.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Landing Page / Auth Modal                       │
│  [Login]   [Join Existing Team]   [Register Business (5-Seat Trial)]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Creates Org & Manager
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Business Workspace (orgId)                        │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Team Manager (5-Seat Quota)                   │  │
│  │  Seat Usage: [ Manager 1/1 ] [ Team Leader 0/1 ] [ Agents 0/3 ] │  │
│  │  [ + Add Team Member ] -> Creates user & links to orgId          │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│             ┌───────────────────────┴───────────────────────┐          │
│             ▼                                               ▼          │
│  ┌──────────────────────┐                       ┌───────────────────┐  │
│  │ Team Leader View     │                       │ Sales Agent View  │  │
│  │ • Assign Leads       │                       │ • Assigned Leads  │  │
│  │ • Verification Queue │                       │ • Call Logging    │  │
│  │ • Team Performance   │                       │ • Confirm Orders  │  │
│  └──────────┬───────────┘                       └─────────┬─────────┘  │
│             │                                             │            │
│             └───────────────────────┬─────────────────────┘            │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │          Firestore Database (Scoped by orgId)                    │  │
│  │  • organizations/{orgId} (subscription: 'Trial', seats: 5)      │  │
│  │  • users (orgId, role: 'Manager' | 'TeamLeader' | 'Sales')      │  │
│  │  • leads (orgId, assignedToId, status, history)                  │  │
│  │  • orders (orgId, leadId, assignedToId)                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Data Models & Schema Updates**:
  - `Organization`: Add `maxSeats: 5`, `plan: '5-Seat Trial'`, `roleLimits: { manager: 1, teamLeader: 1, sales: 3 }`.
  - `User`: Support `role: 'Manager' | 'TeamLeader' | 'Sales' | 'Agent' | 'Admin' | 'SuperAdmin'`.
  - `server.ts`: Add `/api/organizations/create-member` endpoint using `firebase-admin` to provision new authentication users with pre-set password and email verified without interrupting current session.
- **Security & Access Control**:
  - `firestore.rules` updated to permit managers and team leaders to manage their organization's roster, while sales agents can read and update their assigned leads and create orders.

---

### Implementation Phases (Ready for Approval)

1. **Step 1: Backend Provisioning API (`server.ts`)**: Add secure endpoint for Managers to create team member credentials (auth user + Firestore user profile) with strict 5-seat quota checks.
2. **Step 2: Business Registration UI (`LandingPage.tsx` & `OrganizationSetup.tsx`)**: Add a high-converting "Register Business (Free 5-Seat Trial)" tab and seamless onboarding flow.
3. **Step 3: Team Manager Enhancements (`TeamManager.tsx`)**:
   - Add visual **5-Seat Trial Allocation Bar** (`1 Manager`, `1 Team Leader`, `3 Sales Agents`).
   - Add "Add Team Member" modal with role limits, validation, and copyable credentials card.
4. **Step 4: Role-Based Navigation & Permissions (`Sidebar.tsx`, `LeadManager.tsx`, `App.tsx`)**: Ensure Team Leader and Sales Agent roles have correctly tailored views and privileges.
5. **Step 5: Compilation & Quality Verification**: Verify clean build, zero TypeScript errors, and live end-to-end functionality.
