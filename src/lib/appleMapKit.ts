// Official Apple MapKit JS Configuration & Authorization Token
// Generated with Apple Developer Key ID: X894FF6G9R, Team ID: ZCU3WN2ZW4

export const APPLE_MAPKIT_TOKEN = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ilg4OTRGRjZHOVIifQ.eyJpc3MiOiJaQ1UzV04yWlc0IiwiaWF0IjoxNzkyNTE2NjEwLCJleHAiOjE4MDgyOTM2MTB9.pB4XmUkfwGk9TK4N502w-T7HiSnOUT_-y1D42n5nl1n6XkU0nmxCL9YG_L0mo_XdEmB6JBUxzm-A2CGUZJV-9g';

let isInitialized = false;

export const initAppleMapKit = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const mapkit = (window as any).mapkit;
    if (!mapkit) {
      console.warn('Apple MapKit JS SDK not available yet.');
      resolve(false);
      return;
    }

    if (isInitialized) {
      resolve(true);
      return;
    }

    try {
      mapkit.init({
        authorizationCallback: (done: (token: string) => void) => {
          done(APPLE_MAPKIT_TOKEN);
        },
        language: 'fr-FR',
      });
      isInitialized = true;
      console.log('Official Apple MapKit JS initialized successfully.');
      resolve(true);
    } catch (err) {
      console.error('Failed to initialize Apple MapKit JS:', err);
      resolve(false);
    }
  });
};

/**
 * Supprime immédiatement et en continu tout macaron ou filigrane légal Apple / Leaflet
 * pour garantir un affichage plein écran 100 % épuré et sans distraction visuelle.
 */
export const cleanMapAttributions = (container: HTMLElement | null): (() => void) => {
  if (!container) return () => {};

  const purge = () => {
    // 1. Suppression par sélecteurs MapKit et Leaflet
    const elements = container.querySelectorAll(
      '.mk-brand-container, .mk-brand, .mk-legal, .mk-logo, .mk-attribution, .mk-watermark, .mapkit-attribution-container, .mapkit-attribution, [class*="attribution"], [class*="legal"], a[href*="apple.com"], a[href*="legal"], .leaflet-control-attribution'
    );
    elements.forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
      (el as HTMLElement).style.setProperty('opacity', '0', 'important');
      (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
      (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      try {
        el.remove();
      } catch {
        // no-op
      }
    });

    // 2. Scan textuel et liens résiduels
    const links = container.querySelectorAll('a, span, div');
    links.forEach((node) => {
      const text = node.textContent?.toLowerCase() || '';
      const href = (node as HTMLAnchorElement).href?.toLowerCase() || '';
      if (
        text.includes('légales') ||
        text.includes('legal') ||
        (text.includes('plans') && text.includes('mentions')) ||
        href.includes('apple.com/legal') ||
        href.includes('maps.apple.com')
      ) {
        (node as HTMLElement).style.setProperty('display', 'none', 'important');
        try {
          node.remove();
        } catch {
          // no-op
        }
      }
    });
  };

  purge();
  const observer = new MutationObserver(() => {
    purge();
  });
  observer.observe(container, { childList: true, subtree: true });

  return () => observer.disconnect();
};

