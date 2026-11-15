# Silk & Sugar

Website for Silk & Sugar, a gourmet bakery in Austin, Texas that bakes cookies, muffins and banana bread for group events.

Plain HTML, CSS and JavaScript. No build step.

## Run it locally

```bash
python3 -m http.server 8970
```

Then open http://localhost:8970.

## Order requests

The order form reads two settings at the top of `script.js`:

- `FORM_ENDPOINT`: a form service URL (such as Formspree) that emails each request.
- `ORDER_EMAIL`: used for a pre-written email when no endpoint is set.

Each order is paid in full with a Stripe invoice once the date is confirmed.
