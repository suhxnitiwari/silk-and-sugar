# Stripe checkout

`worker.js` is a Cloudflare Worker that turns a built box into a Stripe Checkout page. It prices every order from its own price list and checks the house rules (two dozen minimum, six at a time, three days' notice, delivery from $100), so a buyer cannot change what they pay by editing the website.

Until the worker's URL is pasted into `CHECKOUT_ENDPOINT` in `script.js`, the site keeps sending orders as emailed requests.

## Turn it on

1. **Stripe:** sign up at stripe.com and finish activating the account (business details and the bank account for payouts).
2. **Secret key:** in Stripe, open Developers, then API keys. Start in test mode and copy the secret key that begins with `sk_test_`.
3. **Worker:** in the Cloudflare dashboard, open Workers & Pages, create a Worker named `silk-and-sugar-checkout`, choose Edit code, replace everything with `worker.js`, and deploy.
4. **Secret:** in that Worker, open Settings, then Variables and Secrets. Add a secret named `STRIPE_SECRET_KEY` and paste the key as its value.
5. **Connect the site:** copy the Worker's address (it ends in `workers.dev`) into `CHECKOUT_ENDPOINT` in `script.js` and publish.
6. **Test:** place an order on the site and pay with the test card `4242 4242 4242 4242`, any future expiry date and any CVC.
7. **Go live:** swap the secret for the live key that begins with `sk_live_`.

## In Stripe settings

- Settings, Customer emails: turn on emails for successful payments, so every buyer gets a receipt.
- Your account's notification settings: turn on successful payments, so you hear about each order.

Each payment shows the bake day, time, name, phone, occasion, pickup or delivery, address, notes and the full box in its metadata.

## Tests

```bash
node --test
```
