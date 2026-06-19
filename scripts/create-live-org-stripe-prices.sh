#!/usr/bin/env bash
#
# Create the six LIVE org-tier products/prices in Stripe and print a ready-to-paste
# ORG_PLAN_PRICES_LIVE block for supabase/functions/create-org-checkout-session/index.ts.
#
# Mirrors lib/subscriptions/orgTiers.ts (the source of truth):
#   Club Starter  $249/mo · $2,499/yr
#   Club Pro      $499/mo · $4,999/yr   (plan_id "professional")
#   Enterprise    $899/mo · $8,999/yr
#
# This talks to the LIVE Stripe account — it creates real billing catalog objects.
# It does NOT charge anyone; prices are inert until a checkout uses them. Run it once.
# Re-running creates DUPLICATE products/prices (Stripe has no upsert here), so if you
# need to redo it, archive the old products in the Dashboard first.
#
# Requirements: stripe CLI (https://stripe.com/docs/stripe-cli) and jq.
#
# Auth — pick ONE:
#   a) export STRIPE_API_KEY=sk_live_xxx   (preferred for a one-shot script)
#   b) stripe login --live                  (interactive, persists the key)
# The --live flag below forces live mode regardless, so a stray test key errors out
# rather than silently creating test prices.

set -euo pipefail

command -v stripe >/dev/null || { echo "ERROR: stripe CLI not found. Install: https://stripe.com/docs/stripe-cli"; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq not found. brew install jq"; exit 1; }

# Force live mode. If STRIPE_API_KEY is set we pass it explicitly; otherwise the CLI
# uses the key from `stripe login --live`.
STRIPE_FLAGS=(--live)
if [[ -n "${STRIPE_API_KEY:-}" ]]; then
  case "$STRIPE_API_KEY" in
    sk_live_*) STRIPE_FLAGS+=(--api-key "$STRIPE_API_KEY") ;;
    *) echo "ERROR: STRIPE_API_KEY is not an sk_live_ key. Refusing to create live prices with it."; exit 1 ;;
  esac
fi

# The Stripe CLI prints the created object as JSON on stdout by default (no
# --output flag — older CLI versions don't accept it), so pipe straight to jq.
create_product() {
  # $1 = display name, $2 = description -> echoes the product id
  stripe products create "${STRIPE_FLAGS[@]}" \
    --name "$1" -d "description=$2" | jq -r '.id'
}

create_price() {
  # $1 = product id, $2 = unit amount (cents), $3 = interval (month|year) -> echoes price id
  stripe prices create "${STRIPE_FLAGS[@]}" \
    --product "$1" --unit-amount "$2" --currency usd \
    -d "recurring[interval]=$3" | jq -r '.id'
}

echo "Creating LIVE org products + prices…" >&2

STARTER_PROD=$(create_product "Club Starter" "Up to 500 members")
STARTER_MONTHLY=$(create_price "$STARTER_PROD" 24900 month)
STARTER_ANNUAL=$(create_price "$STARTER_PROD" 249900 year)

PRO_PROD=$(create_product "Club Pro" "Up to 2,000 members")
PRO_MONTHLY=$(create_price "$PRO_PROD" 49900 month)
PRO_ANNUAL=$(create_price "$PRO_PROD" 499900 year)

ENT_PROD=$(create_product "Enterprise" "Unlimited members")
ENT_MONTHLY=$(create_price "$ENT_PROD" 89900 month)
ENT_ANNUAL=$(create_price "$ENT_PROD" 899900 year)

cat <<EOF

Done. Paste this into ORG_PLAN_PRICES_LIVE in
supabase/functions/create-org-checkout-session/index.ts (replace the empty TODOs):

const ORG_PLAN_PRICES_LIVE: PlanPriceTable = {
  starter: {
    monthly: '$STARTER_MONTHLY', // \$249/mo
    annual: '$STARTER_ANNUAL', // \$2,499/yr
  },
  professional: {
    monthly: '$PRO_MONTHLY', // \$499/mo
    annual: '$PRO_ANNUAL', // \$4,999/yr
  },
  enterprise: {
    monthly: '$ENT_MONTHLY', // \$899/mo
    annual: '$ENT_ANNUAL', // \$8,999/yr
  },
};

Or just send me the six price IDs and I'll wire + redeploy.
EOF
