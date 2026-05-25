# Content Safety Lock

> **Smarter content filtering for Firefox — no subscription, no cloud, no compromises.**

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange?logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/content-safety-lock/)
[![Version](https://img.shields.io/badge/version-1.4.1-blue)](CHANGELOG.md)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue)](LICENSE)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen)](#privacy-first-by-design)

---

## Why Content Safety Lock is Different

Most content filters work by consulting a blocklist — a centrally maintained database that someone has to manually curate, that costs money to operate, and that knows every site you visit. **Content Safety Lock takes a fundamentally different approach.**

### 1. It trusts publishers, not gatekeepers

Thousands of adult websites voluntarily label their content using open standards: the **RTA (Recreational Technology Association) label**, **ICRA/SafeSurf ratings**, and HTML meta tags like `rating=adult`. Content Safety Lock reads these signals directly from the page — the same way a responsible website intends them to be used.

**Your browsing stays on your computer. Always.**

### 2. It blocks content, not entire sites

Because filtering happens at the page level, the extension can make surgical decisions:

- Block NSFW posts on Reddit **without** blocking Reddit itself
- Hide mature-rated products on Amazon **without** blocking the store
- Filter explicit content on Tumblr **per post**, not per blog
- Enforce SafeSearch on Google, Bing, YouTube, and more

No more choosing between "block the whole site" or "see everything."

### 3. No subscription. No account. No cost.

There is no database to maintain and no cloud service to pay for. The work happens in real time, locally, using signals the publishers themselves provide. Install it once and it works — forever.

---

## Who It's For

| Audience | Use Case |
|----------|----------|
| **Adults seeking self-control** | Set a time-locked commitment to stay clean — with anti-tamper tools that make it genuinely hard to cheat |
| **Parents** | Configure category-based filtering with a PIN-protected settings page, safe-search enforcement, and per-site block lists |
| **IT administrators** | Deploy managed policy via Firefox's enterprise policy engine to enforce settings across a fleet |

---

## Feature Highlights

### Self-Lock — A Commitment Tool for Adults

Self-Lock is the most distinctive feature of this extension. You set a duration — minutes, hours, days, weeks, even months — and the extension locks itself. Changing the settings is not possible until the timer expires.

![Self-Lock activation screen](docs/screenshots/self-lock-activate.png)
*The Self-Lock tab lets you configure duration, scope, and anti-tamper options before committing.*

**What makes it hard to cheat:**

- **Mandatory cool-down period** — Even if you allow early unlock, you must wait a configurable delay (minutes to hours) before the lock releases. There is no "just this once" button.
- **Commitment passphrase** — Set a passphrase *before* you activate the lock. You cannot change or remove it while the lock is running, so a moment of weakness cannot undo your earlier commitment.
- **Typing verification** — To request early unlock you must type out a randomly generated phrase in full. Impulsive taps don't count.
- **Mastermind puzzle unlock** *(new in 1.4)* — Replace the passphrase flow with a Mastermind-style color-sequence puzzle. Every wrong guess can add time to the lock, turning impatience into a longer commitment.
- **Clock manipulation protection** — Attempting to trick the lock by rolling back your system clock is detected and backfires: the lock duration is extended by exactly the amount you tried to shave off.

![Self-Lock active state](docs/screenshots/self-lock-active.png)
*When Self-Lock is active, blocked pages show a clear overlay with the remaining lock duration.*

---

### Safe Request Mode — Enforce Safe Search at the Network Level

Before a page even loads, Content Safety Lock modifies outbound requests to major platforms to enforce their own safe-content modes.

![Safe Request Mode settings](docs/screenshots/safe-request-mode.png)

| Service | What it does |
|---------|--------------|
| **Google** | Enforces SafeSearch |
| **Bing** | Enforces Strict mode (optional redirect to `strict.bing.com`) |
| **Yahoo** | Enforces Strict mode |
| **DuckDuckGo** | Enforces Safe mode |
| **YouTube** | Enforces Restricted mode (Strict or Moderate) |
| **Reddit** | Filters NSFW posts from API responses |
| **Tumblr** | Removes mature/explicit/adult posts from feeds |

---

### Parental Controls — Surgical, Category-Based Filtering

The General settings tab gives parents and administrators fine-grained control over what gets blocked.

![General settings tab](docs/screenshots/general-settings.png)

**Content categories** — Enable or disable blocking independently for:
- Sexual / Nudity
- Violence
- Profanity
- Drugs / Alcohol
- Gambling

**Allow-list and block-list** — Whitelist trusted domains or force-block specific sites regardless of label status.

**Settings PIN** — Protect the settings page with a PIN. When a PIN is set, the settings view locks automatically after 5 minutes of inactivity and can be manually locked with a single click.

**Adult Product Sales** — Detect and remove adult-oriented product tiles from Amazon without blocking the store (uses server-emitted category labels, not keyword matching).

---

### Advanced Detection — Beyond Simple Meta Tags

Content Safety Lock layers multiple detection methods so content can't easily slip through:

- **RTA label** (`RTA-5042-1996-1400-1577-RTA`) — the most widely deployed voluntary adult content signal on the web
- **ICRA / SafeSurf PICS ratings** — parses structured ratings for sexual content, violence, profanity, drug references, and gambling
- **HTML meta tags** — `rating=adult`, `rating=mature`, `rating=restricted`
- **18 U.S.C. § 2257 compliance links** — detects the legal compliance statements that adult content producers in the US are required to publish, providing an additional signal even when explicit labels are absent
- **Dynamic content detection** — a `MutationObserver` catches labels injected by JavaScript after the initial page load (single-page apps, infinite scroll)
- **Iframe detection** — embedded frames with adult labels are blocked independently

---

### Managed Policy (Enterprise / IT)

Administrators can push a Firefox managed policy JSON to lock down settings across an entire organization or household.

```json
{
  "3rdparty": {
    "Extensions": {
      "content-safety-lock@dwright.org": {
        "locked": true,
        "enabled": { "value": true, "locked": true },
        "safeRequestMode": {
          "enabled": { "value": true, "locked": true }
        }
      }
    }
  }
}
```

You can lock the entire settings page, or lock individual settings while leaving others adjustable by the user — giving administrators precise control over what can and cannot be changed.

See [documentation/MANAGED_POLICY.md](documentation/MANAGED_POLICY.md) for the full reference.

---

## Privacy First, By Design

| Property | Status |
|----------|--------|
| External requests made | **None** |
| Data collected | **None** |
| Analytics or telemetry | **None** |
| Browsing history sent anywhere | **Never** |
| Subscription required | **No** |
| Account required | **No** |

All state — settings, lock status, passphrases (stored as SHA-256 hashes) — lives exclusively in your local Firefox profile via `browser.storage.local`.

---

## Installation

### From Firefox Add-ons (recommended)

> [Install from addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/content-safety-lock/)

Developers and contributors: see [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) for instructions on loading from source and building a distributable package.

---

## Quick Start

1. **Install** the extension and click its toolbar icon
2. **Open Full Options** from the popup
3. **General tab** — choose which content categories to block and optionally set a settings PIN
4. **Safe Request Mode tab** — enable safe-search enforcement for search engines and social platforms
5. **Self-Lock tab** *(optional)* — set a duration and click **Activate Self-Lock** to commit

For a step-by-step walkthrough see [QUICKSTART.md](QUICKSTART.md).

---

## Browser & Platform Support

| Platform | Support |
|----------|---------|
| Firefox 109+ (desktop) | ✅ Full support |
| Firefox ESR (latest) | ✅ Full support |
| Firefox for Android | ✅ Full support |
| Private browsing windows | ✅ Identical enforcement |
| Windows / macOS / Linux | ✅ All platforms |

---

## Honest Limitations

This extension is a voluntary tool. It is designed to raise the cost of impulsive behavior, not to be an unbreakable vault.

- **It depends on publishers labeling their content honestly.** Most responsible adult content publishers do — but malicious actors don't. Sites that deliberately avoid labeling their content will not be caught by this extension alone. Conversely, this extension catches labeled content that blocklist-based filters miss entirely. For the strongest coverage, use it alongside a traditional blocklist-based filter — the two approaches are complementary, not competing.
- **A user with admin privileges can uninstall the extension.** Using a separate OS user account without admin rights significantly strengthens the commitment.
- **OS-level clock changes are detected but not prevented.** Clock rollback extends the lock duration by the manipulated amount.
- **Deleting the Firefox profile removes all lock state.** Store recovery codes somewhere safe and offline.

For tips on stronger setups see [documentation/SECURITY.md](documentation/SECURITY.md).

---

## Documentation

| Document | Contents |
|----------|----------|
| [QUICKSTART.md](QUICKSTART.md) | 5-minute setup guide |
| [CHANGELOG.md](CHANGELOG.md) | Full version history |
| [documentation/FEATURES.md](documentation/FEATURES.md) | Complete feature reference |
| [documentation/MANAGED_POLICY.md](documentation/MANAGED_POLICY.md) | Enterprise policy reference |
| [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) | Build, sign, and submit |
| [documentation/ROADMAP.md](documentation/ROADMAP.md) | Long-term vision |

---

## Contributing & Support

**Author**: Dan Wright  
**GitHub**: [@dwright](https://github.com/dwright)

Bug reports and feature requests: please [open an issue](../../issues) in the repository.

---

## License

Released under the [GNU General Public License v3.0](LICENSE) (GPLv3). You are free to use, modify, and distribute this software, but any distributed modifications must also be released under the GPLv3.

---

## Disclaimer

Content Safety Lock is a voluntary tool for adults. It is not a substitute for dedicated parental control software for children, professional mental health support, or responsible device management. Users are responsible for their own choices and should use this tool as part of a broader personal safety strategy.

This software is provided **as-is, without warranty of any kind**. The author makes no warranties — express or implied — regarding fitness for any particular purpose, correctness, or freedom from defects. Use this software at your own risk. The author is not liable for any loss, damage, or harm arising from its use or failure to perform as expected. Additional disclaimers, limitations, and terms are set forth in the [GNU General Public License v3.0](LICENSE), which governs this software. By using this software you agree to be bound by its terms.
