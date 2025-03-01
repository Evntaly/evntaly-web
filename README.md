<p align="center">
  <img src="https://evntaly.com/assets/images/app_cover.png" alt="Evntaly Cover" width="100%">
</p>

<h3 align="center">Evntaly Web SDK</h3>

<p align="center">
 An advanced event tracking and analytics platform designed to help developers capture, analyze, and react to user interactions efficiently.
</p>

# evntaly-web

**Evntaly Web SDK** is a lightweight JavaScript library for integrating event tracking directly into websites. It supports **automatic event tracking**, **manual event logging**, **user identification**, and **page view tracking**.

## Features

- **Automatic Button Click Tracking** using `data-event` attributes
- **Manual Event Tracking** via `window.evntaly()` function
- **Identify Users** for personalized analytics
- **Automatic Page View Tracking** on route changes
- **Enable or Disable Tracking** dynamically

## Installation

### Using a `<script>` Tag

Add the following to your HTML file:

```html
<script async src="https://cdn.evntaly.com/evntaly-web.js"></script>
<script>
    window.evntalyInit("YOUR_API_TOKEN", "YOUR_PROJECT_TOKEN");
</script>
```

## Usage

### Automatic Button Click Tracking

```html
<button
    data-event="Upgraded Plan"
    data-user-id="user-123"
    data-channel="billing"
    data-icon="💰"
    data-tag-plan="Pro"
    data-tag-period="Monthly"
    data-tag-price="9.99">
        Upgrade to Pro
</button>
```

- The SDK automatically tracks **click events** on buttons with `data-event` attributes.

### Manual Event Tracking

```html
<script>
window.evntaly("track", {
    event: "Manual Event",
    userId: "user-123",
    channel: "manual",
    icon: "✅",
    tags: { plan: "Pro" }
});
</script>
```

### Identify User

```html
<script>
window.evntaly("identifyUser", {
    id: "user-123",
    email: "user@example.com",
    full_name: "John Doe",
    organization: "ExampleCorp",
    data: {
        location: "USA",
        timezone: "America/New_York"
    }
});
</script>
```

### Enable or Disable Tracking

```html
<script>
window.evntaly("disableTracking"); // Disables all event tracking
window.evntaly("enableTracking"); // Enables event tracking
</script>
```

### Automatic Page View Tracking

The SDK automatically tracks **Page Viewed** events when:
- The **page loads**
- The **URL changes** via `history.pushState` or `popstate` events

## License

This project is licensed under the **MIT License**.

---

*Note: Replace **`'YOUR_API_TOKEN'`** and **`'YOUR_PROJECT_NAME'`** with actual credentials.*

