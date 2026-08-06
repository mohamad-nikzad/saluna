# SMS segmentation belongs to the provider billing profile

One SMS Credit represents one provider-billable SMS segment. Before a salon-funded send, Saluna uses the active provider's SMS Billing Profile to estimate the segment count from the final encoded text and shows the estimated credit cost. After an accepted send, Saluna records the provider's reported actual cost and reconciles it with the estimate.

The default profile follows ordinary GSM segmentation: GSM-7 text uses 160 characters for one segment and 153 per concatenated segment; Unicode/UCS-2 text, including Persian, uses 70 and 67 respectively. These values belong to the provider profile and may be replaced when a provider or route uses different rules.

Provider adapters own segmentation and cost interpretation. Salon Subscription definitions, SMS balances, and the meaning of an SMS Credit remain provider-neutral, so changing provider does not rewrite commercial entitlements.
