# Birthday Follow-Up is a yearly occurrence

Each Client birthday produces a distinct Birthday Follow-Up for that Jalali year rather than reopening a previous follow-up. This preserves the manager's decision and outreach history for each birthday and prevents message history from one year being mistaken for another.

The follow-up enters the Retention Queue seven Salon-local days before the birthday. It remains actionable through the end of the seventh Salon-local day after the birthday. If no action closes it, it expires after that window instead of remaining as permanent queue noise.

A daily check runs at 07:00 Salon-local time. When an occurrence first becomes eligible, every manager with access to the shared Retention Queue receives one in-app notification and one web push, deep-linked to the queue. Birthday reminders do not also notify managers through SMS or messaging accounts and are not repeated daily. Once one manager handles or dismisses the shared occurrence, it closes for every manager.

The daily check is one idempotent CLI command invoked through Saluna's existing system-cron pattern. It creates newly eligible occurrences, expires occurrences whose windows ended, and sends each manager notification at most once. It does not add a queue service or scheduling dependency.

Opening the phone dialer does not prove that a call occurred and therefore does not close the occurrence. A successful Saluna-sent Client message closes it automatically; calls and messages sent outside Saluna require the manager to mark it handled. A manager may dismiss the occurrence without outreach.

Every Client with a Client Birth Date receives an occurrence, including a Client who already has an upcoming Appointment. Other open Client Follow-Ups remain distinct and visible; the Birthday Follow-Up is prioritized in the queue but does not merge or close inactive, VIP, no-show, or manual follow-ups.

Birthday Follow-Ups extend the existing Client Follow-Up and Retention Queue concepts. They do not introduce a parallel customer-moments queue or a new analytics dashboard. Occurrence status, timestamps, and message deliveries remain available for later comparison of 30-day completed-visit rates for handled and expired occurrences.
