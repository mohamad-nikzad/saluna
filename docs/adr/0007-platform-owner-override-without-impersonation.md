# Platform Owner Override without impersonation

Ordinary platform setup access ends at Salon Handoff, but a Platform Owner may override that boundary to edit an active salon when an operational need exists. Override is attributable through audit events, but it does not require a free-text reason or live-data confirmation because those checks add admin friction without enough value for this product stage. It never exposes authentication secrets, takes over a session, or acts under another user's identity.
