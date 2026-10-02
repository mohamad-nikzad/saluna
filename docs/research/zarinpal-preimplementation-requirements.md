# ZarinPal pre-implementation requirements

**Checked:** 2026-08-05  
**Scope:** Saluna's own Subscription Purchase and SMS Credit Bundle revenue.
This does not cover future salon-owned Client Payments.

## Short answer

Implementation does not need to wait for production credentials. ZarinPal's
sandbox accepts any UUID-shaped merchant ID and uses the sandbox host in place
of the production payment host. Production launch does require an approved
merchant account, an active terminal for Saluna's domain, and a matching
settlement account. [Sandbox documentation](https://www.zarinpal.com/docs/paymentGateway/sandBox)

## Set up before production integration

1. **Choose the merchant identity.** The ZarinPal merchant must be Saluna's
   owner—the person or company selling the SaaS—not a Salon and not a developer
   account. An individual must be at least 18 and provide name, national or
   foreign-resident ID, email, active mobile, address, and postal code. A company
   must provide its articles, incorporation notice and latest official-gazette
   changes, identification/contact details for the CEO or authorized
   signatories, and a representative letter.
   [ZarinPal terms, section 3](https://www.zarinpal.com/terms)
2. **Complete KYC and activate the terminal.** ZarinPal describes registration,
   identity verification, document review, and activation as the gateway
   onboarding flow. Its error list says a terminal cannot transact below the
   required silver verification level.
   [Gateway onboarding](https://www.zarinpal.com/payment-gateway),
   [error codes `-11` and `-16`](https://www.zarinpal.com/docs/paymentGateway/errorList)
3. **Add the settlement bank account.** Account/card details may be requested
   and must belong to the registered merchant identity. Confirm the settlement
   account and cadence in the dashboard before launch.
   [ZarinPal information policy](https://www.zarinpal.com/policy),
   [gateway settlement description](https://www.zarinpal.com/payment-gateway)
4. **Register the correct Saluna domain and business category.** ZarinPal rejects
   a callback whose domain does not match the terminal (`-14`) and rejects use
   from an unrelated referrer/domain (`-18`). Its terms also prohibit using a
   terminal outside the registered line of business. For this plan, confirm
   that the terminal accepts the callback host `api.saluna.ir`, not only
   `saluna.ir`.
   [Error list](https://www.zarinpal.com/docs/paymentGateway/errorList),
   [ZarinPal terms, section 4](https://www.zarinpal.com/terms)
5. **Confirm the production server IP.** The gateway introduction asks the
   merchant to declare the main server IP, and invalid merchant/IP combinations
   can produce `-10`. Saluna currently documents the VPS origin as
   `195.177.255.24`; confirm that this remains the outbound IP before registering
   it. A registered terminal IP is explicitly mandatory if the 30-minute
   reverse API is used.
   [Gateway technical information](https://www.zarinpal.com/docs/paymentGateway/),
   [reverse documentation](https://www.zarinpal.com/docs/paymentGateway/moreFeatures/reverse)
6. **Decide who pays the fee.** The request/verify response reports
   `fee_type` as `Merchant` or `Payer`, and the terminal setting controls it.
   Because the plan says Saluna absorbs gateway fees—and ZarinPal's terms
   prohibit adding an extra amount to the buyer—configure `Merchant` and verify
   it in a real low-value transaction. Current public standard pricing is 0.5%
   up to 16,000 toman plus 500 toman per transaction; use the gateway's fee
   calculation/result for reconciliation rather than hard-coding that tariff.
   [Connection guide](https://www.zarinpal.com/docs/paymentGateway/connectToGateway),
   [current pricing](https://www.zarinpal.com/pricing),
   [fee calculation](https://www.zarinpal.com/docs/paymentGateway/otherMethods/feeCalculation)
7. **Start the compliance work in parallel.** ZarinPal offers an eNAMAD issuance
   flow, but the public pages reviewed do not state the exact eNAMAD or tax-file
   prerequisites for this specific merchant/category. Check the live onboarding
   dashboard or open a support ticket before treating either as complete. Have
   Saluna's public identity/contact, pricing, terms, privacy, refund, and service
   description pages ready for that review.
   [ZarinPal eNAMAD flow](https://www.zarinpal.com/campaign/enamad/),
   [contact/support](https://www.zarinpal.com/contact)
8. **Define a refund procedure before launch.** ZarinPal currently marks its
   refund service temporarily disabled. The separate reverse endpoint only
   covers a successful payment within 30 minutes and requires terminal IP
   registration. Therefore the plan's “processed manually at the gateway” step
   must be confirmed with support and backed by an operational alternative.
   [Refund status](https://www.zarinpal.com/features/refund/),
   [reverse limits](https://www.zarinpal.com/docs/paymentGateway/moreFeatures/reverse)

## Values needed by the implementation

- Production merchant ID: 36-character terminal merchant ID, server-side only.
- Production request endpoint:
  `https://payment.zarinpal.com/pg/v4/payment/request.json`.
- Production verify endpoint:
  `https://payment.zarinpal.com/pg/v4/payment/verify.json`.
- Production redirect base:
  `https://payment.zarinpal.com/pg/StartPay/`.
- Production callback:
  `https://api.saluna.ir/api/v1/billing/callback/zarinpal`, registered/approved
  for the terminal.
- Sandbox host: replace `https://payment.zarinpal.com` with
  `https://sandbox.zarinpal.com`; an arbitrary UUID merchant ID is sufficient.
- Currency: `IRT` on the payment request, so `amount` is toman.
- Required request data: merchant ID, integer amount, description (maximum 500
  characters), and callback URL. Put manager phone and Saluna order ID under
  `metadata.mobile` and `metadata.order_id`; both are optional gateway fields.

Sources: [connection guide](https://www.zarinpal.com/docs/paymentGateway/connectToGateway),
[currency documentation](https://www.zarinpal.com/docs/paymentGateway/moreFeatures/currency),
[sandbox documentation](https://www.zarinpal.com/docs/paymentGateway/sandBox),
[error list](https://www.zarinpal.com/docs/paymentGateway/errorList).

The ordinary request/verify flow requires the merchant ID, not an OAuth access
token. ZarinPal's SDK documentation reserves an access token for account-level
operations such as refunds and transaction management.
[SDK configuration](https://www.zarinpal.com/docs/sdk/nodejs/configuration)

## Corrections and clarifications for the launch plan

1. **Do not send `currency` to verification.** The plan repeatedly says request
   and verification both send `IRT`. Official request documentation supports
   `currency: "IRT"`; official REST and Node verification documentation list
   only merchant ID, authority, and the stored amount (the SDK injects merchant
   ID). Verification must use the same snapshotted toman amount, but its test
   should not require an undocumented currency field.
   [Currency request](https://www.zarinpal.com/docs/paymentGateway/moreFeatures/currency),
   [REST verification](https://www.zarinpal.com/docs/paymentGateway/connectToGateway),
   [Node verification](https://www.zarinpal.com/docs/sdk/nodejs/method/verify)
2. **Specify metadata nesting.** “Send the local order ID and manager phone”
   should mean `metadata.order_id` and `metadata.mobile`, not top-level REST
   fields.
   [Request parameter table](https://www.zarinpal.com/docs/paymentGateway/connectToGateway)
3. **Make callback-domain registration explicit.** The current environment list
   names a callback URL but does not say its host must match the registered
   terminal domain. This is a production blocker (`-14`).
4. **Replace the assumed refund workflow.** Keep Saluna's immutable refund
   record, but do not assume a currently available ZarinPal refund action until
   support confirms the operational rail.
5. **Keep the existing `100`/`101` handling.** Official documentation confirms
   that `100` is the first successful verification and later verification of
   the same transaction returns `101`. The plan's rule not to grant again on an
   unreconciled `101` is sound.
   [Verification behavior](https://www.zarinpal.com/docs/paymentGateway/connectToGateway)

## Minimal start gate

Coding can start when these are decided:

- callback URL and registered production hostname;
- merchant identity (individual or company);
- amount unit fixed to toman internally and `IRT` only on request;
- sandbox UUID and sandbox/production host switch;
- refund deliberately excluded from the first adapter.

Production enablement additionally requires completed KYC, an active merchant
terminal/ID, matching settlement account, domain/IP approval, fee-payer setting,
and one successful request-return-verify-settlement reconciliation.
