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
    let locationCache = null; // Cache location data to avoid repeated API calls
    let locationPromise = null; // Track ongoing location fetch
        let sessionId = null; // Store the session ID
    let userId = null; // Store the user ID

    /**
     * Generate a unique session identifier that persists for the browser session.
     * Uses sessionStorage to maintain the same ID across page reloads within the same tab/window.
     * @returns {string} A unique session identifier
     */
    function generateSessionId() {
      // Try to get existing session ID from sessionStorage
      try {
        const existingSessionId = sessionStorage.getItem('evntaly_session_id');
        if (existingSessionId) {
          return existingSessionId;
        }
      } catch (e) {
        // sessionStorage might not be available (private browsing, etc.)
        console.warn('Evntaly: sessionStorage not available, using temporary session ID');
      }

      // Generate new session ID: timestamp + random string
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 8);
      const newSessionId = `evs_${timestamp}_${randomPart}`;

      // Try to store in sessionStorage for persistence across page loads
      try {
        sessionStorage.setItem('evntaly_session_id', newSessionId);
      } catch (e) {
        // Storage might be full or disabled, continue without storing
        console.warn('Evntaly: Could not store session ID in sessionStorage');
      }

      return newSessionId;
    }

    /**
     * Get the current session ID, generating one if it doesn't exist
     * @returns {string} The current session identifier
     */
    function getSessionId() {
      if (!sessionId) {
        sessionId = generateSessionId();
      }
      return sessionId;
    }

    /**
     * Generate a unique user identifier that persists across browser sessions.
     * Uses localStorage to maintain the same ID across visits to your website.
     * @returns {string} A unique user identifier
     */
    function generateUserId() {
      // Try to get existing user ID from localStorage
      try {
        const existingUserId = localStorage.getItem('evntaly_user_id');
        if (existingUserId) {
          return existingUserId;
        }
      } catch (e) {
        // localStorage might not be available (private browsing, etc.)
        console.warn('Evntaly: localStorage not available, using temporary user ID');
      }

      // Generate new user ID: timestamp + random string (longer than session ID)
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 10);
      const additionalRandom = Math.random().toString(36).substring(2, 6);
      const newUserId = `evu_${timestamp}_${randomPart}_${additionalRandom}`;

      // Try to store in localStorage for persistence across sessions
      try {
        localStorage.setItem('evntaly_user_id', newUserId);
      } catch (e) {
        // Storage might be full or disabled, continue without storing
        console.warn('Evntaly: Could not store user ID in localStorage');
      }

      return newUserId;
    }

    /**
     * Get the current user ID, generating one if it doesn't exist
     * @returns {string} The current user identifier
     */
    function getUserId() {
      if (!userId) {
        userId = generateUserId();
      }
      return userId;
    }

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
      config.disableAutoPageViewTracking = !!options.disableAutoPageViewTracking;
    }

    /**
     * Extract operating system and version from user agent string.
     * @param userAgent - The user agent string.
     * @returns Object with OS name and version.
     */
    function extractOSFromUserAgent(userAgent) {
      if (!userAgent) return { os: 'Unknown', version: 'Unknown' };

      const ua = userAgent.toLowerCase();

      // Mobile OS detection first (more specific)
      if (ua.includes('iphone') || ua.includes('ipod')) {
        const iosMatch = ua.match(/cpu iphone os (\d+)[_.](\d+)[_.]?(\d+)?/);
        if (iosMatch) {
          const version = `${iosMatch[1]}.${iosMatch[2]}${iosMatch[3] ? '.' + iosMatch[3] : ''}`;
          return { os: 'iOS', version };
        }
        return { os: 'iOS', version: 'Unknown' };
      }
      
      if (ua.includes('ipad')) {
        const iosMatch = ua.match(/cpu os (\d+)[_.](\d+)[_.]?(\d+)?/);
        if (iosMatch) {
          const version = `${iosMatch[1]}.${iosMatch[2]}${iosMatch[3] ? '.' + iosMatch[3] : ''}`;
          return { os: 'iOS', version };
        }
        return { os: 'iOS', version: 'Unknown' };
      }
      
      if (ua.includes('android')) {
        const androidMatch = ua.match(/android (\d+(?:\.\d+)*)/);
        if (androidMatch) {
          return { os: 'Android', version: androidMatch[1] };
        }
        return { os: 'Android', version: 'Unknown' };
      }

      // Desktop OS detection
      if (ua.includes('windows nt 10.0')) {
        return { os: 'Windows', version: '10/11' };
      }
      if (ua.includes('windows nt 6.3')) {
        return { os: 'Windows', version: '8.1' };
      }
      if (ua.includes('windows nt 6.2')) {
        return { os: 'Windows', version: '8' };
      }
      if (ua.includes('windows nt 6.1')) {
        return { os: 'Windows', version: '7' };
      }
      if (ua.includes('windows nt 6.0')) {
        return { os: 'Windows', version: 'Vista' };
      }
      if (ua.includes('windows nt 5.1') || ua.includes('windows xp')) {
        return { os: 'Windows', version: 'XP' };
      }
      if (ua.includes('windows')) {
        return { os: 'Windows', version: 'Unknown' };
      }

      // macOS detection with version extraction
      const macMatch = ua.match(/mac os x (\d+)[_.](\d+)[_.]?(\d+)?/);
      if (macMatch) {
        const majorVersion = parseInt(macMatch[1]);
        const minorVersion = parseInt(macMatch[2]);
        const patchVersion = macMatch[3] ? parseInt(macMatch[3]) : 0;
        
        const versionString = `${majorVersion}.${minorVersion}${patchVersion ? '.' + patchVersion : ''}`;
        
        // Map to macOS version names
        if (majorVersion === 10) {
          if (minorVersion >= 15) return { os: 'macOS', version: `${versionString} (Catalina)` };
          if (minorVersion === 14) return { os: 'macOS', version: `${versionString} (Mojave)` };
          if (minorVersion === 13) return { os: 'macOS', version: `${versionString} (High Sierra)` };
          if (minorVersion === 12) return { os: 'macOS', version: `${versionString} (Sierra)` };
          return { os: 'macOS', version: versionString };
        }
        if (majorVersion === 11) return { os: 'macOS', version: `${versionString} (Big Sur)` };
        if (majorVersion === 12) return { os: 'macOS', version: `${versionString} (Monterey)` };
        if (majorVersion === 13) return { os: 'macOS', version: `${versionString} (Ventura)` };
        if (majorVersion === 14) return { os: 'macOS', version: `${versionString} (Sonoma)` };
        if (majorVersion === 15) return { os: 'macOS', version: `${versionString} (Sequoia)` };
        
        return { os: 'macOS', version: versionString };
      }
      
      if (ua.includes('mac os x') || ua.includes('macos')) {
        return { os: 'macOS', version: 'Unknown' };
      }

      // Linux distributions with version detection
      if (ua.includes('ubuntu')) {
        const ubuntuMatch = ua.match(/ubuntu[\/\s](\d+(?:\.\d+)*)/);
        return { os: 'Ubuntu', version: ubuntuMatch ? ubuntuMatch[1] : 'Unknown' };
      }
      if (ua.includes('debian')) {
        return { os: 'Debian', version: 'Unknown' };
      }
      if (ua.includes('fedora')) {
        const fedoraMatch = ua.match(/fedora[\/\s](\d+)/);
        return { os: 'Fedora', version: fedoraMatch ? fedoraMatch[1] : 'Unknown' };
      }
      if (ua.includes('centos')) {
        const centosMatch = ua.match(/centos[\/\s](\d+(?:\.\d+)*)/);
        return { os: 'CentOS', version: centosMatch ? centosMatch[1] : 'Unknown' };
      }
      if (ua.includes('red hat')) {
        return { os: 'Red Hat', version: 'Unknown' };
      }
      if (ua.includes('linux')) {
        return { os: 'Linux', version: 'Unknown' };
      }

      // Other operating systems
      if (ua.includes('freebsd')) {
        const freebsdMatch = ua.match(/freebsd[\/\s](\d+(?:\.\d+)*)/);
        return { os: 'FreeBSD', version: freebsdMatch ? freebsdMatch[1] : 'Unknown' };
      }
      if (ua.includes('openbsd')) {
        return { os: 'OpenBSD', version: 'Unknown' };
      }
      if (ua.includes('netbsd')) {
        return { os: 'NetBSD', version: 'Unknown' };
      }
      if (ua.includes('sunos')) {
        return { os: 'Solaris', version: 'Unknown' };
      }

      return { os: 'Unknown', version: 'Unknown' };
    }

    /**
     * Extract browser and version from user agent string.
     * @param userAgent - The user agent string.
     * @returns Object with browser name and version.
     */
    function extractBrowserFromUserAgent(userAgent) {
      if (!userAgent) return { browser: 'Unknown', version: 'Unknown' };

      const ua = userAgent.toLowerCase();

      // Chrome (must check before Safari as Chrome includes Safari in UA)
      const chromeMatch = ua.match(/chrome\/(\d+(?:\.\d+)*)/);
      if (chromeMatch && !ua.includes('edg') && !ua.includes('opr')) {
        return { browser: 'Chrome', version: chromeMatch[1] };
      }

      // Microsoft Edge (Chromium-based)
      const edgeMatch = ua.match(/edg\/(\d+(?:\.\d+)*)/);
      if (edgeMatch) {
        return { browser: 'Edge', version: edgeMatch[1] };
      }

      // Opera
      const operaMatch = ua.match(/opr\/(\d+(?:\.\d+)*)/);
      if (operaMatch) {
        return { browser: 'Opera', version: operaMatch[1] };
      }

      // Opera (older versions)
      const operaLegacyMatch = ua.match(/opera[\/\s](\d+(?:\.\d+)*)/);
      if (operaLegacyMatch) {
        return { browser: 'Opera', version: operaLegacyMatch[1] };
      }

      // Firefox
      const firefoxMatch = ua.match(/firefox\/(\d+(?:\.\d+)*)/);
      if (firefoxMatch) {
        return { browser: 'Firefox', version: firefoxMatch[1] };
      }

      // Safari (check after Chrome/Edge as they include Safari in UA)
      const safariMatch = ua.match(/version\/(\d+(?:\.\d+)*)/);
      if (safariMatch && ua.includes('safari') && !ua.includes('chrome')) {
        return { browser: 'Safari', version: safariMatch[1] };
      }

      // Internet Explorer
      const ieMatch = ua.match(/(?:msie\s|trident.+?rv:)(\d+(?:\.\d+)*)/);
      if (ieMatch) {
        return { browser: 'Internet Explorer', version: ieMatch[1] };
      }

      // Samsung Internet Browser
      const samsungMatch = ua.match(/samsungbrowser\/(\d+(?:\.\d+)*)/);
      if (samsungMatch) {
        return { browser: 'Samsung Internet', version: samsungMatch[1] };
      }

      // UC Browser
      const ucMatch = ua.match(/ucbrowser\/(\d+(?:\.\d+)*)/);
      if (ucMatch) {
        return { browser: 'UC Browser', version: ucMatch[1] };
      }

      // Brave (harder to detect, often appears as Chrome)
      if (ua.includes('brave')) {
        return { browser: 'Brave', version: 'Unknown' };
      }

      // Vivaldi
      const vivaldiMatch = ua.match(/vivaldi\/(\d+(?:\.\d+)*)/);
      if (vivaldiMatch) {
        return { browser: 'Vivaldi', version: vivaldiMatch[1] };
      }

      // Yandex Browser
      const yandexMatch = ua.match(/yabrowser\/(\d+(?:\.\d+)*)/);
      if (yandexMatch) {
        return { browser: 'Yandex Browser', version: yandexMatch[1] };
      }

      // Mobile browsers
      if (ua.includes('crios')) {
        const criosMatch = ua.match(/crios\/(\d+(?:\.\d+)*)/);
        return { browser: 'Chrome iOS', version: criosMatch ? criosMatch[1] : 'Unknown' };
      }

      if (ua.includes('fxios')) {
        const fxiosMatch = ua.match(/fxios\/(\d+(?:\.\d+)*)/);
        return { browser: 'Firefox iOS', version: fxiosMatch ? fxiosMatch[1] : 'Unknown' };
      }

      if (ua.includes('mobile') && ua.includes('safari')) {
        const mobileSafariMatch = ua.match(/version\/(\d+(?:\.\d+)*)/);
        return { browser: 'Mobile Safari', version: mobileSafariMatch ? mobileSafariMatch[1] : 'Unknown' };
      }

      // Generic fallbacks
      if (ua.includes('webkit')) {
        return { browser: 'WebKit', version: 'Unknown' };
      }

      if (ua.includes('gecko')) {
        return { browser: 'Gecko', version: 'Unknown' };
      }

      return { browser: 'Unknown', version: 'Unknown' };
    }

    /**
     * Extract device type from user agent string.
     * @param userAgent - The user agent string.
     * @returns Device type (Mobile, Tablet, Desktop, Smart TV, Gaming Console, Wearable, Unknown).
     */
    function extractDeviceTypeFromUserAgent(userAgent) {
      if (!userAgent) return 'Unknown';

      const ua = userAgent.toLowerCase();

      // Gaming Consoles
      if (ua.includes('playstation') || ua.includes('xbox') || ua.includes('nintendo')) {
        return 'Gaming Console';
      }

      // Smart TVs
      if (ua.includes('smart-tv') || 
          ua.includes('smarttv') || 
          ua.includes('webos') || 
          ua.includes('tizen') || 
          ua.includes('roku') || 
          ua.includes('appletv') || 
          ua.includes('googletv') || 
          ua.includes('android tv')) {
        return 'Smart TV';
      }

      // Wearables
      if (ua.includes('watch') || 
          ua.includes('wearable') || 
          ua.includes('fitbit') || 
          ua.includes('gear s')) {
        return 'Wearable';
      }

      // Tablets (check before mobile as some tablets might match mobile patterns)
      if (ua.includes('ipad')) {
        return 'Tablet';
      }
      
      // Android tablets - look for tablet keyword or large screen indicators
      if (ua.includes('android') && 
          (ua.includes('tablet') || 
           !ua.includes('mobile') || 
           ua.includes('nexus 7') || 
           ua.includes('nexus 9') || 
           ua.includes('nexus 10'))) {
        return 'Tablet';
      }

      // Windows tablets
      if (ua.includes('windows') && ua.includes('touch') && !ua.includes('phone')) {
        return 'Tablet';
      }

      // Kindle tablets
      if (ua.includes('kindle') && !ua.includes('mobile')) {
        return 'Tablet';
      }

      // Mobile devices
      if (ua.includes('mobile') || 
          ua.includes('iphone') || 
          ua.includes('ipod') || 
          ua.includes('blackberry') || 
          ua.includes('windows phone') || 
          ua.includes('palm') || 
          ua.includes('symbian') || 
          ua.includes('nokia') || 
          ua.includes('fennec') || 
          ua.includes('opera mini') || 
          ua.includes('opera mobi')) {
        return 'Mobile';
      }

      // Android mobile (when mobile keyword is present)
      if (ua.includes('android') && ua.includes('mobile')) {
        return 'Mobile';
      }

      // Desktop/Laptop - check for desktop operating systems
      if (ua.includes('windows') || 
          ua.includes('macintosh') || 
          ua.includes('mac os x') || 
          ua.includes('linux') || 
          ua.includes('ubuntu') || 
          ua.includes('debian') || 
          ua.includes('fedora') || 
          ua.includes('centos') || 
          ua.includes('freebsd') || 
          ua.includes('openbsd')) {
        return 'Desktop';
      }

      // Bots and crawlers
      if (ua.includes('bot') || 
          ua.includes('crawler') || 
          ua.includes('spider') || 
          ua.includes('scraper') || 
          ua.includes('curl') || 
          ua.includes('wget')) {
        return 'Bot';
      }

      return 'Unknown';
    }

    function parseUserAgent(ua) {
      const osInfo = extractOSFromUserAgent(ua);
      const browserInfo = extractBrowserFromUserAgent(ua);
      const deviceType = extractDeviceTypeFromUserAgent(ua);
      
      return {
        os: osInfo.os,
        osVersion: osInfo.version,
        browser: browserInfo.browser,
        browserVersion: browserInfo.version,
        deviceType: deviceType
      };
    }
  
    function getNetworkConnectionType() {
      if (navigator.connection && typeof navigator.connection.effectiveType === 'string') {
        return navigator.connection.effectiveType;
      }
      return null;
    }

    // Fetch location data from free API
    async function fetchLocationData() {
      if (locationCache) {
        return locationCache;
      }
      
      if (locationPromise) {
        return locationPromise;
      }
      
      locationPromise = (async () => {
        try {
          // Using ipapi.co - free tier allows 1000 requests/day
          const response = await fetch('https://ipapi.co/json/', {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch location data');
          }
          
          const data = await response.json();
          
          locationCache = {
            country: data.country_name || null,
            countryCode: data.country_code || null,
            region: data.region || null,
            city: data.city || null,
            timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || null,
            latitude: data.latitude || null,
            longitude: data.longitude || null
          };
          
          return locationCache;
        } catch (error) {
          console.warn('Evntaly: Failed to fetch location data:', error.message);
          // Return default location object with timezone only
          locationCache = {
            country: null,
            countryCode: null,
            region: null,
            city: null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
            latitude: null,
            longitude: null
          };
          return locationCache;
        }
      })();
      
      return locationPromise;
    }

    async function buildRequestContext() {
      const { os, osVersion, browser, browserVersion, deviceType } = parseUserAgent(navigator.userAgent);
      const location = await fetchLocationData();
      
      return {
        userAgent: navigator.userAgent || null,
        referer: document.referrer || null,
        method: 'GET',
        url: window.location.pathname || null,
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
        location: location
      };
    }
  
    async function trackEvent(eventData) {
      if (!config.trackingEnabled) {
        console.warn("🚫 Tracking is disabled. Event not sent.");
        return;
      }
      if (!config.token) {
        console.error("Evntaly: Missing API token. Call window.evntaly('Init', 'TOKEN', 'PROJECT_NAME') first.");
        return;
      }
  
      const requestContext = await buildRequestContext();

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
          user: { id: eventData.userId || getUserId() },
          icon: eventData.icon || "ℹ️",
          apply_rule_only: true,
          notify: true,
          type: eventData.type || "Event",
          sessionID: eventData.sessionID || getSessionId(),
          feature: eventData.channel || "events",
          topic: eventData.topic || "@auto-generated event",
          tags: eventData.tags || [],
          context: {
            sdkVersion: sdkVersion,
            sdkRuntime: "browser",
            sdkSource: "evntaly-web"
          },
          requestContext: requestContext
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
        userId: button.getAttribute("data-user-id") || getUserId(),
        channel: button.getAttribute("data-channel") || "events",
        icon: button.getAttribute("data-icon") || null,
        data: {
          url: window.location.pathname,
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
        },
        topic: button.getAttribute("data-topic") || "@auto-generated-event"
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
        userId: getUserId(),
        topic: "@navigation",
        data: {
          url: window.location.pathname,
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
        type: "Page View",
        icon: '🤓',
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
  