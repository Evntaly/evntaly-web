(function () {
    const queue = (window.evsq = window.evsq || []); // evsq = Event Queue System
    window.evntaly = window.evntaly || function (...args) {
      queue.push(args);
    };
  
    let config = { token: null, project: null, trackingEnabled: true };
  
    function processQueue() {
      while (queue.length > 0) {
        const [command, ...args] = queue.shift();
        if (command === "setConfig") setConfig(...args);
        if (command === "track") trackEvent(...args);
        if (command === "identifyUser") identifyUser(...args);
        if (command === "disableTracking") disableTracking();
        if (command === "enableTracking") enableTracking();
      }
    }
  
    function setConfig(token, projectName) {
      config.token = token;
      config.project = projectName;
    }
  
    function trackEvent(eventData) {
      if (!config.trackingEnabled) {
        console.warn("🚫 Tracking is disabled. Event not sent.");
        return;
      }
      if (!config.token) {
        console.error("Evntaly: Missing API token. Call window.evntaly('setConfig', 'TOKEN', 'PROJECT_NAME') first.");
        return;
      }
  
      fetch("https://evntaly.com/prod/api/v1/register/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Project-Token": config.token,
        },
        body: JSON.stringify({
          title: eventData.event,
          description: "User interaction",
          message: "Automatically tracked event.",
          data: eventData.tags,
          user: { id: eventData.userId || "anonymous" },
          feature: eventData.channel || "events",
          icon: eventData.icon || "ℹ️",
          type: "Button Click",
        }),
      });
    }
  
    function identifyUser(userData) {
      if (!config.token) {
        console.error("Evntaly: Missing API token. Call window.evntaly('setConfig', 'TOKEN', 'PROJECT_NAME') first.");
        return;
      }
      fetch("https://evntaly.com/prod/api/v1/identify/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Project-Token": config.token,
        },
        body: JSON.stringify(userData),
      });
    }
  
    function disableTracking() {
      config.trackingEnabled = false;
      console.log("🚫 Event tracking disabled.");
    }
  
    function enableTracking() {
      config.trackingEnabled = true;
      console.log("✅ Event tracking enabled.");
    }
  
    function trackButtonClick(event) {
      const button = event.target.closest("button[data-event]");
      if (!button) return;
  
      const eventData = {
        event: button.getAttribute("data-event"),
        userId: button.getAttribute("data-user-id") || null,
        channel: button.getAttribute("data-channel") || "events",
        icon: button.getAttribute("data-icon") || null,
        tags: {},
      };
  
      [...button.attributes].forEach(attr => {
        if (attr.name.startsWith("data-tag-")) {
          const tagName = attr.name.replace("data-tag-", "");
          eventData.tags[tagName] = attr.value;
        }
      });
  
      window.evntaly("track", eventData);
    }
  
    function trackPageView() {
      if (!config.trackingEnabled) return;
      const eventData = {
        event: "Page Viewed",
        userId: null,
        channel: "navigation",
        tags: {
          url: window.location.href,
          referrer: document.referrer,
        },
      };
      window.evntaly("track", eventData);
    }
  
    document.addEventListener("click", trackButtonClick);
  
    if (window.history.pushState) {
      const originalPushState = window.history.pushState;
      window.history.pushState = function (...args) {
        originalPushState.apply(this, args);
        trackPageView();
      };
    }
  
    window.addEventListener("popstate", trackPageView);
    window.addEventListener("load", trackPageView);
    setInterval(processQueue, 100);
  })();
  