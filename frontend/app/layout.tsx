import "@cloudscape-design/global-styles/index.css";
import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Route 53 Clone",
  description: "AWS Route 53 console clone — Next.js, FastAPI, SQLite",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
