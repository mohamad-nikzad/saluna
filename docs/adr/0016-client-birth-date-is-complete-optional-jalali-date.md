# Client Birth Date is a complete optional Jalali date

A Client may have a Client Birth Date. It is optional so ordinary Client creation and imports remain valid when the manager does not know it, but when present it contains a real Jalali year, month, and day.

Saluna treats the Jalali date as authoritative rather than accepting Gregorian manager input or storing only a recurring month and day. The API validates a real Jalali date that is not in the future, converts it to one native database `date` value, and converts it back for display and annual recurrence. No arbitrary maximum age is imposed. The complete date allows the age reached on a future birthday to be derived without storing an age that becomes stale.

Managers record or edit the date manually through Client create/edit, and the Client profile displays it. VCF, CSV, and Device Contact imports do not import birth dates in this release. A birth date of ۳۰ اسفند recurs on ۲۹ اسفند in non-leap Jalali years.

Correcting a Client Birth Date preserves closed Birthday Follow-Ups as history. An open occurrence for the old date expires; a replacement is created only if the corrected date falls inside the active birthday window. Adding a birth date during its active window creates the current occurrence immediately, while adding it after the window waits until the next Jalali year.

Birthday reminders, age personalization, collection consent, and outbound-message policy are separate decisions. This decision only establishes the Client Birth Date itself.
