# Effinity Tag for Google Tag Manager Server-Side

The **Effinity Tag** for Google Tag Manager Server-Side enables you to send conversion data directly to the Effinity affiliate marketing platform from your server. This server-to-server integration provides a more reliable and secure method for tracking sales and leads from your affiliate campaigns.

The tag supports two main actions:

- **Page View**: Captures Effinity tracking parameters from the URL and stores them in a cookie for later use.
- **Conversion**: Sends sale or lead data to Effinity, attributing it to the correct affiliate campaign.

## How to Use the Effinity Tag

### Page View Tracking

This tag should be set up to fire on all page views to capture affiliate tracking IDs from the URL.

1.  Add the **Effinity Tag** `template.tpl` file to your server container.
2.  Set the **Action Type** to `Page View`.
3.  (Optional) Configure the **Cookie Settings** (`Domain`, `SameSite`, `Expiration`) as needed.
4.  Set up a trigger to fire the tag on every page view (e.g., when your `page_view` event fires).

### Conversion Tracking

This tag should fire when a conversion (a sale or lead) occurs.

1.  Add the **Effinity Tag** `template.tpl` file to your server container.
2.  Set the **Action Type** to `Conversion`.
3.  Select the **Conversion Type** (`Sale` or `Lead`).
4.  Enter your **Effinity ID**.
5.  Specify the **Consent** field.
6.  Provide the **Order or Lead ID**.
7.  For `Sale` conversions, specify the **Value** and **Currency Code**.
8.  (Optional) Configure other parameters like `Voucher Code`, `Payment Type`, `Cart Details`, `Attribution Type` or `Custom Fields`.
9.  Set up a trigger to fire the tag when a conversion event occurs (e.g., on a `purchase` or `generate_lead` event).

## Useful Resources:

- [Step-by-step guide on how to configure Effinity Tag](https://stape.io/helpdesk/documentation/effinity-tag)

## Open Source

The **Effinity Tag for GTM Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🟢 [Listed](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/effinity-tag)
