"use client";

import type { AdminTab } from "@/components/admin/AdminConsole";
import { AdminDashboardPanel } from "@/components/admin/AdminDashboardPanel";
import { AdminProductsPanel } from "@/components/admin/AdminProductsPanel";
import { AdminOrdersPanel } from "@/components/admin/AdminOrdersPanel";
import { AdminInventoryPanel } from "@/components/admin/AdminInventoryPanel";
import { AdminReviewsPanel } from "@/components/admin/AdminReviewsPanel";
import { AdminContentPanel } from "@/components/admin/AdminContentPanel";
import { AdminSettingsPanel } from "@/components/admin/AdminSettingsPanel";
import { AdminLogsPanel } from "@/components/admin/AdminLogsPanel";

export function AdminWorkspace({ tab }: { tab: AdminTab }) {
  switch (tab) {
    case "overview": return <AdminDashboardPanel />;
    case "products": return <AdminProductsPanel />;
    case "orders": return <AdminOrdersPanel />;
    case "inventory": return <AdminInventoryPanel />;
    case "reviews": return <AdminReviewsPanel />;
    case "content": return <AdminContentPanel />;
    case "settings": return <AdminSettingsPanel />;
    case "logs": return <AdminLogsPanel />;
  }
}
