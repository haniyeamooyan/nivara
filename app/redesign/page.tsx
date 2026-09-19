import type { Metadata } from "next";
import PrototypeSandbox from "@/components/views/prototype-sandbox";

export const metadata: Metadata = {
  title: "Nivara Redesign Prototype | پیش‌نمایش طراحی نیوارا",
  description: "طراحی جدید و پروتوتایپ تعاملی سامانه مدیریت بودجه نیوارا روی شاخه fix/style",
};

export default function RedesignPage() {
  return <PrototypeSandbox />;
}
