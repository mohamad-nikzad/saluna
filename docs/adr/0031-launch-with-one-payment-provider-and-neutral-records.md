# Launch with one Payment Provider and provider-neutral records

Zarinpal is Saluna's only launch Payment Provider. Saluna will implement its request, redirect, and verification flow directly rather than build a multi-gateway router or generic framework before a second provider is required.

Subscription Purchases and Verified Payments store a Payment Provider identifier plus opaque provider references; subscription state and entitlements contain no Zarinpal-specific fields. Replacing the provider therefore changes the checkout and verification boundary without rewriting commercial history or Salon access rules.
