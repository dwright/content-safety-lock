# Managed Policy for Content Safety Lock

Administrators can pre-configure and lock settings in Content Safety Lock using
Firefox's managed-storage facility.  Settings delivered via managed policy take
precedence over anything saved by the user.

Only settings on the **General** tab are manageable (content filtering and Safe
Request Mode).  Self-lock and security settings are intentionally excluded.

---

## How it works

1. The administrator creates a **native-manifest JSON file** (see below) and
   places it in the correct location for the target operating system.
2. Firefox loads the file at browser startup and makes its `data` object
   available via `browser.storage.managed`.
3. The extension reads managed values each time state is loaded, merges them on
   top of any user-saved values, and locks the corresponding UI controls.
4. Controls governed by managed policy display a blue **Managed** badge and
   cannot be interacted with.

> **Note:** Firefox requires a browser restart to pick up changes to a native
> manifest file.

---

## Enabled-field format

Every boolean setting that can be managed uses an **object** with two optional
fields:

```json
{ "value": true, "locked": true }
```

| Field | Type | Default when absent | Meaning |
| ----- | ---- | ------------------- | ------- |
| `value` | boolean | `DEFAULT_STATE` value | The value to apply to the setting |
| `locked` | boolean | inherited from parent (see below) | Whether the user can change the setting |

Examples:

| Policy spec | Value used | User can change? |
| ----------- | ---------- | ---------------- |
| `{ "value": true, "locked": true }` | `true` | No |
| `{ "value": false, "locked": true }` | `false` | No |
| `{ "locked": true }` | DEFAULT_STATE value | No |
| `{ "value": true }` | `true` | Yes (unless parent is locked) |
| `{ "value": false }` | `false` | Yes (unless parent is locked) |
| `{}` or absent | DEFAULT_STATE value | Yes (unless parent is locked) |

---

## Lock inheritance

When a parent setting is locked, all child settings inherit `locked: true` by
default.  A child can opt out by explicitly specifying `"locked": false`.

Example: lock `safeRequestMode` on but allow the user to toggle Reddit:

```json
{
  "safeRequestMode": {
    "enabled": { "value": true, "locked": true },
    "providers": {
      "reddit": { "enabled": { "locked": false } }
    }
  }
}
```

Because `safeRequestMode.enabled` is locked, all providers are locked by
default — except Reddit, which explicitly overrides with `locked: false`.

---

## Top-level UI lock (`locked`)

Set `"locked": true` at the top level to put the entire General tab into a
read-only view (similar to self-lock).  The user sees a synopsis of all
settings but has no controls and no unlock button.

```json
{
  "locked": true,
  "parental": { ... },
  "safeRequestMode": { ... }
}
```

---

## Minimal example: lock Safe Request Mode on, leave everything else editable

```json
{
  "safeRequestMode": {
    "enabled": { "value": true, "locked": true }
  }
}
```

---

## Provider sub-field examples

### Lock YouTube to strict mode

```json
{
  "safeRequestMode": {
    "providers": {
      "youtube": {
        "enabled":    { "value": true,     "locked": true },
        "headerMode": { "value": "strict", "locked": true }
      }
    }
  }
}
```

### Lock Bing on and force the strict.bing.com redirect

```json
{
  "safeRequestMode": {
    "providers": {
      "bing": {
        "enabled":     { "value": true, "locked": true },
        "useRedirect": { "value": true, "locked": true }
      }
    }
  }
}
```

---

## Wildcard shorthand (`*`)

For sections with many similar settings, use the `*` wildcard to apply the same configuration to all items in that section without listing them individually.

| Section | Wildcard applies to |
| --------- | ------------------- |
| `parental.categories` | All content categories |
| `parental.adultProductSalesVendors` | All vendor monitors |
| `safeRequestMode.providers` | All Safe Request Mode providers |

### Example: Lock all content categories on

```json
{
  "parental": {
    "categories": {
      "*": { "value": true, "locked": true }
    }
  }
}
```

### Example: Lock all Safe Request Mode providers on

```json
{
  "safeRequestMode": {
    "enabled": { "value": true, "locked": true },
    "providers": {
      "*": { "enabled": { "value": true, "locked": true } }
    }
  }
}
```

### Example: Wildcard with specific overrides

Enable all adult product sales vendors, but leave eBay unlocked for the user:

```json
{
  "parental": {
    "adultProductSalesVendors": {
      "*": { "value": true, "locked": true },
      "ebay": { "value": true, "locked": false }
    }
  }
}
```

The wildcard expansion preserves any explicitly-specified entries, so you can set a default for all items and then override specific ones.

---

## Supported managed keys

### `parental` section

| Key | Type | Description |
| --- | ---- | ----------- |
| `parental.enabled` | boolean | Enable/disable content filtering |
| `parental.treatMatureAsAdult` | boolean | Treat "mature"/"restricted" labels as adult |
| `parental.allowList` | array | Domains that always bypass filtering |
| `parental.blockList` | array | Domains that are always blocked |
| `parental.categories.sexual` | boolean | Block sexual/nudity content |
| `parental.categories.violence` | boolean | Block violence content |
| `parental.categories.profanity` | boolean | Block profanity content |
| `parental.categories.drugs` | boolean | Block drugs/alcohol content |
| `parental.categories.gambling` | boolean | Block gambling content |
| `parental.categories.ageVerification` | boolean | Block age-verification pages |
| `parental.categories.adultProductSales` | boolean | Block adult product sales |
| `parental.adultProductSalesVendors.etsy` | boolean | Monitor Etsy |
| `parental.adultProductSalesVendors.redbubble` | boolean | Monitor Redbubble |
| `parental.adultProductSalesVendors.teepublic` | boolean | Monitor TeePublic |
| `parental.adultProductSalesVendors.zazzle` | boolean | Monitor Zazzle |
| `parental.adultProductSalesVendors.itchIo` | boolean | Monitor itch.io |
| `parental.adultProductSalesVendors.ebay` | boolean | Monitor eBay |
| `parental.adultProductSalesVendors.amazon` | boolean | Monitor Amazon |
| `parental.adultProductSalesVendors.patreon` | boolean | Monitor Patreon |
| `parental.adultProductSalesVendors.shopify` | boolean | Monitor Shopify |

### `safeRequestMode` section

| Key | Type | Description |
| --- | ---- | ----------- |
| `safeRequestMode.enabled` | boolean | Enable/disable Safe Request Mode |
| `safeRequestMode.addPreferSafeHeader` | boolean | Add `Prefer: safe` header |
| `safeRequestMode.applyInPrivateWindows` | boolean | Apply in private browsing windows |
| `safeRequestMode.blockUserParamDowngrade` | boolean | Block user attempts to disable safe params |
| `safeRequestMode.perFrameEnforcement` | string | `"any"` or `"top"` |
| `safeRequestMode.providers.google` | object | Google SafeSearch — `enabled` |
| `safeRequestMode.providers.bing` | object | Bing Strict Mode — `enabled` |
| `safeRequestMode.providers.bing.useRedirect` | object | Redirect to strict.bing.com |
| `safeRequestMode.providers.yahoo` | object | Yahoo Strict Mode — `enabled` |
| `safeRequestMode.providers.ddg` | object | DuckDuckGo Strict Mode — `enabled` |
| `safeRequestMode.providers.youtube` | object | YouTube Restricted Mode — `enabled` |
| `safeRequestMode.providers.youtube.headerMode` | object | Restriction level: `"strict"` or `"moderate"` |
| `safeRequestMode.providers.tumblr` | object | Tumblr mature-content filter — `enabled` |
| `safeRequestMode.providers.reddit` | object | Reddit NSFW filter — `enabled` |

---

## Delivering the policy

### macOS — recommended (system-wide, survives Firefox updates)

Place `org.mozilla.firefox.plist` in `/Library/Managed Preferences/`.
macOS treats this directory as MDM-delivered managed preferences, and
Firefox reads the `3rdparty` key from it.

The plist must contain `EnterprisePoliciesEnabled = true` and the
`3rdparty` block.  A minimal example in JSON form (convert to plist with
`plutil -convert xml1`):

```json
{
  "EnterprisePoliciesEnabled": true,
  "3rdparty": {
    "Extensions": {
      "content-safety-lock@dwright.org": {
        "parental": { "enabled": true },
        "safeRequestMode": { "enabled": true }
      }
    }
  }
}
```

To deploy as `admin`:

```bash
sudo cp /Library/Preferences/org.mozilla.firefox.plist \
        "/Library/Managed Preferences/org.mozilla.firefox.plist"
```

To apply to a single user only, place it in the per-user subdirectory
instead:

```bash
sudo cp /Library/Preferences/org.mozilla.firefox.plist \
        "/Library/Managed Preferences/<username>/org.mozilla.firefox.plist"
```

Restart Firefox after any change.

### macOS — local testing only (wiped on Firefox update)

For quick local testing you can place a `policies.json` file inside the
app bundle.  **This file is deleted when Firefox updates itself**, so it
is not suitable for production use.

```text
/Applications/Firefox.app/Contents/Resources/distribution/policies.json
```

### Linux

```text
/etc/firefox/policies/policies.json     (system-wide)
```

```bash
sudo mkdir -p /etc/firefox/policies
sudo tee /etc/firefox/policies/policies.json > /dev/null << 'EOF'
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "content-safety-lock@dwright.org": {
          "parental": { "enabled": true },
          "safeRequestMode": { "enabled": true }
        }
      }
    }
  }
}
EOF
```

### Windows

Create `policies.json` in the `distribution` folder next to `firefox.exe`,
or use Group Policy / ADMX templates to deploy the `3rdparty` policy key.
See the [Firefox policy templates](https://github.com/mozilla/policy-templates)
repository for ADMX/ADML files.

---

## Enterprise policy (policies.json) full example

```json
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "content-safety-lock@dwright.org": {
          "parental": {
            "enabled": true,
            "categories": { "sexual": true }
          },
          "safeRequestMode": {
            "enabled": true
          }
        }
      }
    }
  }
}
```

The `policies.json` file is placed in the Firefox installation directory under
`distribution/policies.json` (or managed via MDM/GPO on Windows).

---

## Security considerations

Managed policy is enforced by the extension itself at the application layer.
It is **not** a browser-enforced security boundary — a technically sophisticated
user who can modify the extension files or Firefox profile could circumvent it.
For a stronger enforcement boundary consider combining managed policy with OS-level
user account restrictions or Firefox enterprise policy to prevent extension
modification.
