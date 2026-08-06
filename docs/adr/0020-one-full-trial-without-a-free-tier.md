# Each Salon Owner receives one full Trial without a permanent free tier

Each verified Salon Owner receives the complete product for one 30-day Trial, applied to the first Salon they activate. Setup Salon preparation does not consume Trial time, and creating or activating another Salon does not grant that owner another Trial. The billing-launch transition in ADR-0024 is a one-time exception for Salons already active when billing begins. Saluna will not offer a permanent free tier.

An unpaid Salon becomes read-only when its Trial ends: existing business data remains readable, while ordinary operational writes wait for payment. This avoids deleting or holding salon data hostage while keeping the commercial boundary meaningful. Commercial access remains separate from the Salon's lifecycle status; an active Salon does not become a Setup Salon or lose ownership when payment lapses.

We chose a full Trial over freemium because early Saluna requires assisted adoption and ongoing support, while a permanent free entitlement would add plan-gating complexity and weaken the reason to pay before its acquisition value is proven.
