import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "云文档 · 在线协作",
  description: "优雅的在线文档协作系统 · 表格 + 富文本 + 实时协作",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
