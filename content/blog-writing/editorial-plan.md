# Blog editorial plan

The daily draft should answer an uncovered reader question. Build breadth across
salon work and customer needs before expanding sections of the first few posts.
Use the production article coverage map to choose a topic, then check current
sources. These ideas are candidates, not preapproved claims or guaranteed gaps.

## Audiences and future categories

Use two audience categories in the editorial plan:

- `salon-owners`, برای صاحبان سالن. Decisions about running a salon, managing
  services and a team, customer experience, and attracting customers.
- `customers`, برای مشتریان. Choosing a salon or service, preparing for a visit,
  explaining preferences, and understanding appointment arrangements.

Choose one primary audience for each article. Write for that reader's problem;
customer articles do not need a manager signup invitation. Use a relevant next
step only when the current public product supports it.

Categories and topic tags are a future CMS and website change, requested for
documentation only on 2026-10-11. No schema, existing article classification,
public filter, or category page changes are part of this scheduler update.
For now record `audience` and proposed `topicTags` in the private novelty record.
Do not submit these as CMS fields until the content model supports them.

Future implementation should add the two reusable audience categories to Blog
Articles, show the category on article cards and pages, and offer a simple
audience filter on the blog index. Use topic tags separately for subjects such
as نوبت‌دهی، تجربه مشتری، بازاریابی سالن، خدمات و قیمت‌گذاری، مدیریت تیم، and
گزارش‌های مالی. Read published and pending content before classifying it.
Keep existing slugs and publication states stable. Confirm the content model,
editor workflow, draft adapter fields, and public queries together before
rolling out those fields in production.

## Topic selection

For each new daily run, propose at least three reader questions across different
subject families. Include a customer candidate; select the strongest uncovered
question rather than enforcing an audience quota. Check the full production
corpus, including drafts. Favor an untouched family over a narrower treatment
of an existing section. A new title, audience label, or tag does not make
repeated advice distinct.

| Source subject            | Typical audience | Candidate reader questions                                                |
| ------------------------- | ---------------- | ------------------------------------------------------------------------- |
| `service-catalog`         | Salon owners     | How should service names, durations, and prices be presented clearly?     |
| `service-packages`        | Salon owners     | When does bundling services help, and how should a package be explained?  |
| `salon-presence`          | Salon owners     | What should a salon's public page tell someone before they contact it?    |
| `customer-experience`     | Both             | How can the salon and customer agree on expectations before a visit?      |
| `customer-visit-planning` | Customers        | What should a customer ask before choosing a salon or requesting a time?  |
| `salon-marketing`         | Salon owners     | How can a salon announce availability with a clear call to action?        |
| `client-followups`        | Salon owners     | How should a salon plan a useful, respectful follow-up?                   |
| `salon-reporting`         | Salon owners     | Which operational numbers help an owner review the week?                  |
| `team-onboarding`         | Salon owners     | What should a new team member know before their first working day?        |
| `salon-setup`             | Salon owners     | What needs to be ready before inviting customers to a new salon page?     |
| `staff-scheduling`        | Salon owners     | Which scheduling decisions are still uncovered by the current article?    |
| `staff-commission`        | Salon owners     | Which commission decisions are still uncovered by the current article?    |
| `appointment-requests`    | Both             | Which appointment decisions are still uncovered by the current article?   |
| `client-records`          | Salon owners     | Which client-record decisions are still uncovered by the current article? |

The source map is a starting point for checking product behavior, not a
restriction to feature tutorials. Articles may give practical editorial advice
about salon operations, marketing, or a customer's visit. Distinguish advice
from capabilities Saluna actually provides. Label worked scenarios as examples
and do not invent customer results, statistics, or market trends.

For claims beyond repository evidence, consult current primary sources and save
their URLs, access dates, and supported claims in the novelty record's
`externalSources`. Research before asserting legal, financial, medical, or
cosmetic safety advice. Avoid unsourced treatment instructions and promises.
The daily runner freezes repository sources; the editorial record separately
preserves external research. Recheck both before submission.
