import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "Void Runner",
  description: "A 3D retro-futuristic runner game controlled by browser AI gesture tracking.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Void Runner",
    description: "A 3D retro-futuristic runner game controlled by browser AI gesture tracking.",
    url: "/",
    siteName: "Void Runner",
    images: [
      {
        url: "/LOGO.jpeg",
        width: 1200,
        height: 1200,
        alt: "Void Runner Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Void Runner",
    description: "A 3D retro-futuristic runner game controlled by browser AI gesture tracking.",
    images: ["/LOGO.jpeg"],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/LOGO.jpeg", type: "image/jpeg" },
    ],
    apple: [
      { url: "/LOGO.jpeg", type: "image/jpeg" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <Script id="security-protection" strategy="beforeInteractive">
          {`
            (function() {
              var hostname = window.location.hostname;
              var isLocal = hostname === 'localhost' || 
                            hostname === '127.0.0.1' || 
                            hostname.startsWith('192.168.') || 
                            hostname.startsWith('10.') || 
                            /^172\\.(1[6-9]|2[0-9]|3[0-1])\\./.test(hostname);
              
              if (!isLocal) {
                // Disable Right-Click context menu
                document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
                
                // Disable DevTools Keyboard Shortcuts
                document.addEventListener('keydown', function(e) {
                  // F12
                  if (e.keyCode === 123) {
                    e.preventDefault();
                  }
                  // Ctrl + Shift + I (Inspect), Ctrl + Shift + J (Console), Ctrl + Shift + C (Inspect Element)
                  if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
                    e.preventDefault();
                  }
                  // Ctrl + U (View Source)
                  if (e.ctrlKey && e.keyCode === 85) {
                    e.preventDefault();
                  }
                  // Ctrl + S (Save Page)
                  if (e.ctrlKey && e.keyCode === 83) {
                    e.preventDefault();
                  }
                });

                // Disable dragging images/videos
                document.addEventListener('dragstart', function(e) {
                  if (e.target.nodeName === 'IMG' || e.target.nodeName === 'VIDEO') {
                    e.preventDefault();
                  }
                });

                // Anti-Debugging: Freeze execution if DevTools is opened
                setInterval(function() {
                  debugger;
                }, 100);
              }
            })();
          `}
        </Script>
        {children}</body>
    </html>
  );
}
