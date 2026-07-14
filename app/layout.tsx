import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const metadataContent: Metadata = {
  title: "CampusPlan | 대학생활 플래너",
  description:
    "수업, 과제, 시험과 캠퍼스 날씨를 한눈에 관리하는 반응형 대학생활 플래너",
  applicationName: "CampusPlan",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "CampusPlan",
    title: "CampusPlan | 대학생활 플래너",
    description: "오늘을 놓치지 않는 대학생활 플래너",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "CampusPlan 일정·시간표·캠퍼스 날씨 미리보기",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CampusPlan | 대학생활 플래너",
    description: "오늘을 놓치지 않는 대학생활 플래너",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

function safeMetadataBase(host: string | null, protocol: string | null) {
  const fallback = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!host) return new URL(fallback);

  const normalizedHost = host.split(",")[0].trim();
  const local = normalizedHost.startsWith("localhost") || normalizedHost.startsWith("127.0.0.1");
  const normalizedProtocol = protocol?.split(",")[0].trim() || (local ? "http" : "https");

  try {
    return new URL(`${normalizedProtocol}://${normalizedHost}`);
  } catch {
    return new URL(fallback);
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto");

  return {
    ...metadataContent,
    metadataBase: safeMetadataBase(host, protocol),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
