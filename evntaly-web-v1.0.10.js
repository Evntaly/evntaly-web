(function () {

    const queue = (window.evsq = window.evsq || []); // evsq = Event Queue System
    window.evntaly = window.evntaly || function (...args) {
      queue.push(args);
    };
  
    let config = { token: null, project: null, trackingEnabled: true };
    let sdkVersion = "1.0.10"; 
    const apiBaseUrl = "https://app.evntaly.com/prod/api/v1";
    // const apiBaseUrl = "http://localhost:3000/api/v1";
    let isSetupComplete = false; // Track whether setup has been done
    let hasLoadFired = false; // Track if load event already fired
  
    // Check if document already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      hasLoadFired = true;
    } else {
      window.addEventListener("load", function() {
        hasLoadFired = true;
      });
    }
  
    function processQueue() {
      while (queue.length > 0) {
        const [command, ...args] = queue.shift();
        if (command === "init") {
          setConfig(...args);
          
          // Setup event listeners only once after initial configuration
          if (!isSetupComplete) {
            document.addEventListener("click", trackButtonClick);
            
            // Only setup page view tracking if not disabled
            if (!config.disableAutoPageViewTracking) {
              setupAutoPageViewTracking();
              
              // Trigger initial page view if page already loaded
              if (hasLoadFired) {
                console.log("Initial page view triggered manually");
                setTimeout(trackPageView, 0); // Use timeout to ensure config is fully processed
              }
            }
            
            isSetupComplete = true;
          }
        }
        if (command === "track") trackEvent(...args);
        if (command === "identifyUser") identifyUser(...args);
        if (command === "disableTracking") disableTracking();
        if (command === "enableTracking") enableTracking();
      }
    }
  
    function setConfig(token, projectName, options = {}) {
      config.token = token;
      config.project = projectName;
      config['disableAutoPageViewTracking'] = options.disableAutoPageViewTracking;
      console.log(config);
      console.log(config['disableAutoPageViewTracking']);
    }

    function parseUserAgent(ua) {
      let os = 'Unknown OS';
      let osVersion = '';
      let browser = 'Unknown Browser';
      let browserVersion = '';
      let deviceType = 'desktop';
    
      // OS Detection with version
      const windowsMatch = ua.match(/Windows NT ([\d.]+)/);
      const macMatch = ua.match(/Mac OS X ([\d_]+)/);
      const androidMatch = ua.match(/Android ([\d.]+)/);
      const iosMatch = ua.match(/iPhone OS ([\d_]+)/);
      const linuxMatch = ua.match(/Linux/);
    
      if (windowsMatch) {
        os = 'Windows';
        osVersion = windowsMatch[1];
      } else if (macMatch) {
        os = 'macOS';
        osVersion = macMatch[1].replace(/_/g, '.');
      } else if (androidMatch) {
        os = 'Android';
        osVersion = androidMatch[1];
        deviceType = 'mobile';
      } else if (iosMatch) {
        os = 'iOS';
        osVersion = iosMatch[1].replace(/_/g, '.');
        deviceType = 'mobile';
      } else if (linuxMatch) {
        os = 'Linux';
      }
    
      // Browser Detection
      if (/Chrome\/([0-9.]+)/.test(ua)) {
        browser = 'Chrome';
        browserVersion = ua.match(/Chrome\/([0-9.]+)/)[1];
      } else if (/Firefox\/([0-9.]+)/.test(ua)) {
        browser = 'Firefox';
        browserVersion = ua.match(/Firefox\/([0-9.]+)/)[1];
      } else if (/Safari\/([0-9.]+)/.test(ua) && !/Chrome/.test(ua)) {
        browser = 'Safari';
        const versionMatch = ua.match(/Version\/([0-9.]+)/);
        browserVersion = versionMatch ? versionMatch[1] : '';
      } else if (/Edg\/([0-9.]+)/.test(ua)) {
        browser = 'Edge';
        browserVersion = ua.match(/Edg\/([0-9.]+)/)[1];
      }

      // Device type detection
      if (/Mobi|Android/i.test(ua)) {
        deviceType = 'mobile';
      } else if (/Tablet|iPad/i.test(ua)) {
        deviceType = 'tablet';
      }
    
      return { os, osVersion, browser, browserVersion, deviceType };
    }
  
    function getNetworkConnectionType() {
      if (navigator.connection && typeof navigator.connection.effectiveType === 'string') {
        return navigator.connection.effectiveType;
      }
      return null;
    }

    function buildRequestContext() {
      const { os, osVersion, browser, browserVersion, deviceType } = parseUserAgent(navigator.userAgent);
      
      return {
        userAgent: navigator.userAgent || null,
        referer: document.referrer || null,
        method: 'GET',
        url: window.location.href || null,
        host: window.location.host || null,
        origin: window.location.origin || null,
        acceptLanguage: navigator.language || null,
        acceptEncoding: null, // Not available in browser
        contentType: 'text/html',
        xForwardedProto: window.location.protocol?.replace(':', '') || null,
        xForwardedHost: null, // Not available in browser
        xRequestedWith: 'XMLHttpRequest',
        authorization: null, // Not available in browser
        cfIpCountry: null, // Not available in browser
        cfRay: null, // Not available in browser
        os: os,
        osVersion: osVersion,
        browser: browser,
        browserVersion: browserVersion,
        deviceType: deviceType,
        location: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          // Other location fields would need geolocation API or server-side detection
          country: null,
          countryCode: null,
          region: null,
          city: null,
          latitude: null,
          longitude: null
        }
      };
    }
  
    function trackEvent(eventData) {
      if (!config.trackingEnabled) {
        console.warn("🚫 Tracking is disabled. Event not sent.");
        return;
      }
      if (!config.token) {
        console.error("Evntaly: Missing API token. Call window.evntaly('Init', 'TOKEN', 'PROJECT_NAME') first.");
        return;
      }
  
      const { os, browser } = parseUserAgent(navigator.userAgent);

      fetch(`${apiBaseUrl}/register/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "secret": config.token,
          "pat": config.project,
        },
        body: JSON.stringify({
          title: eventData.event,
          description: "User interaction",
          message: "Automatically tracked event.",
          data: eventData.data || {},
          user: { id: eventData.userId || "anonymous" },
          icon: eventData.icon || "ℹ️",
          apply_rule_only: true,
          notify: true,
          type: "",
          sessionID: eventData.sessionID || null,
          feature: eventData.channel || "events",
          topic: eventData.topic || "@auto-generated event",
          tags: eventData.tags || [],
          context: {
            sdkVersion: sdkVersion,
            sdkRuntime: "browser",
            sdkSource: "evntaly-web"
          },
          requestContext: buildRequestContext()
        }),
      });
    }
  
    function identifyUser(userData) {
      if (!config.token) {
        console.error("Evntaly: Missing API token. Call window.evntaly('setConfig', 'TOKEN', 'PROJECT_NAME') first.");
        return;
      }
      fetch(`${apiBaseUrl}/register/user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "secret": config.token,
          "pat": config.project,
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

      const { os, browser } = parseUserAgent(navigator.userAgent);

      const eventData = {
        event: button.getAttribute("data-event"),
        userId: button.getAttribute("data-user-id") || null,
        channel: button.getAttribute("data-channel") || "events",
        icon: button.getAttribute("data-icon") || null,
        data: {
          url: window.location.href,
          referrer: document.referrer,
          utm: {
            source: new URLSearchParams(window.location.search).get("utm_source") || null,
            medium: new URLSearchParams(window.location.search).get("utm_medium") || null,
            campaign: new URLSearchParams(window.location.search).get("utm_campaign") || null,
            term: new URLSearchParams(window.location.search).get("utm_term") || null
          },
          userAgent: navigator.userAgent,
          platform: (navigator.userAgentData && navigator.userAgentData.platform) || null,
          appVersion: navigator.appVersion,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          networkConnectionType: getNetworkConnectionType(),
        },
        tags: [],
        context: {
          sdkVersion: sdkVersion,
          sdkRuntime: "browser",
          operatingSystem: os,
          browser: browser
        }
      };  
  
      [...button.attributes].forEach(attr => {
        if (attr.name.startsWith("data-tag-")) {
          const tagName = attr.name.replace("data-tag-", "");
          eventData.tags.push(`${tagName}:${attr.value}`);
        }
      });

      [...button.attributes].forEach(attr => {
        if (attr.name.startsWith("data-payload-")) {
          const tagName = attr.name.replace("data-payload-", "");
          eventData.data[tagName] = attr.value;
        }
      });
  
      window.evntaly("track", eventData);
    }
  
    function trackPageView() {
      if (!config.trackingEnabled) return;

      const { os, browser } = parseUserAgent(navigator.userAgent);

      const eventData = {
        event: "Page Viewed",
        userId: null,
        topic: "@navigation",
        data: {
          url: window.location.href,
          referrer: document.referrer,
          utm: {
            source: new URLSearchParams(window.location.search).get("utm_source") || null,
            medium: new URLSearchParams(window.location.search).get("utm_medium") || null,
            campaign: new URLSearchParams(window.location.search).get("utm_campaign") || null,
            term: new URLSearchParams(window.location.search).get("utm_term") || null
          },
          userAgent: navigator.userAgent,
          platform: (navigator.userAgentData && navigator.userAgentData.platform) || null,
          appVersion: navigator.appVersion,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          networkConnectionType: getNetworkConnectionType(),
        },
        type: "pageview",
        icon: '🔥',
        context: {
          sdkVersion: sdkVersion,
          sdkRuntime: "browser",
          operatingSystem: os,
          browser: browser
        }
      };
      window.evntaly("track", eventData);
    }
  
    function setupAutoPageViewTracking() {
      if (window.history.pushState) {
        const originalPushState = window.history.pushState;
        window.history.pushState = function (...args) {
          originalPushState.apply(this, args);
          if (!config.disableAutoPageViewTracking) {
            trackPageView();
          }
        };
      }
      
      window.addEventListener("popstate", function() {
        if (!config.disableAutoPageViewTracking) {
          trackPageView();
        }
      });
      
      window.addEventListener("load", function() {
        if (!config.disableAutoPageViewTracking) {
          trackPageView();
        }
      });
    }
  
    setInterval(processQueue, 100);
  })();
  