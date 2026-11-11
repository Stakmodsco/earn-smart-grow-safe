# Mining Activator and scheduled MINE accrual

## What will be built
- Add a standalone Mining area where users submit proof for a fixed $5 Mining Activator, view its manual review status, and see MINE earned separately from cash.
- Count only directly referred users whose Mining Activator is admin-approved. Every 10 qualified referrals increase the speed by 1×, on top of the base 1.78 MINE/hour.
- Accrue only the exact eligible seconds while the user's last sign-in is within 24 hours. Keep MINE, activator requests, and mining history separate from cash balances and transactions.
- Add an authenticated server-side processor scheduled every five minutes, with overlap protection, run history, errors, and an admin status/history view.

## Implementation outline
1. Add isolated, row-secured mining tables and a database processing function; do not alter existing cash, profile, referral, or auth data.
2. Add the Mining page and an admin activation-review/status panel using existing authentication, referral records, and admin patterns.
3. Add and schedule the server-side worker through Lovable Cloud's supported Jobs mechanism; validate it through a real successful run before describing it as active.
4. Run the relevant tests and inspect the latest preview diagnostics.

## Important boundaries
- Mining is simulated only: no blockchain, external investment, or cash redemption.
- Activator approval is manual and based on the user's submitted payment proof.
- Sign-in eligibility is the existing auth record's server-side last sign-in time, limited to the most recent 24 hours.
