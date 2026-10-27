# KeyMIDI Store

MIDI store for keyboard learners.

## Local setup

    npm install
    copy .env.example .env
    notepad .env
    npm start

Visit http://localhost:3000

## Add MIDI files

Drop .mid files into private/midi/ with names matching data/products.json:
- clocks-free.mid, clocks-chorus.mid, clocks-full.mid
- river-free.mid, river-chorus.mid, river-full.mid

## Stripe

1. Get test keys: https://dashboard.stripe.com/apikeys
2. Put sk_test_... in .env as STRIPE_SECRET_KEY
3. Test card: 4242 4242 4242 4242, any future date, any CVC

## Deploy

Push to GitHub, connect on Render, add env vars, upload MIDI files.