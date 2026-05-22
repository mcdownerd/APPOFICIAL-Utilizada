"use client";

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MenuIcon, LogOutIcon, TruckIcon, UtensilsCrossedIcon, BarChart3Icon, HistoryIcon, UsersIcon, SettingsIcon, PanelLeftOpenIcon, PanelLeftCloseIcon, MonitorIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { name: "sendCodes", path: "/estafeta", icon: TruckIcon, roles: ["estafeta", "admin"] },
  { name: "counter", path: "/balcao", icon: UtensilsCrossedIcon, roles: ["restaurante", "admin"] },
  { name: "ecranEstafeta", path: "/ecran-estafeta", icon: MonitorIcon, roles: ["restaurante", "admin"] },
  { name: "history", path: "/historico", icon: HistoryIcon, roles: ["restaurante", "admin"] },
  { name: "timeAnalysis", path: "/analise-tempo", icon: BarChart3Icon, roles: ["admin", "restaurante"] },
  { name: "manageUsers", path: "/admin/users", icon: UsersIcon, roles: ["admin"] },
];

const getRoleTheme = (role: string | undefined) => {
  switch (role) {
    case "estafeta":
      return {
        bg: "from-amber-50 to-orange-100",
        text: "text-orange-800",
      };
    case "restaurante":
      return {
        bg: "from-purple-50 to-indigo-100",
        text: "text-indigo-800",
      };
    case "admin":
      return {
        bg: "from-blue-50 to-indigo-100",
        text: "text-indigo-800",
      };
    default:
      return {
        bg: "from-gray-50 to-gray-100",
        text: "text-gray-800",
      };
  }
};

const StatusCard = ({ title, message, buttonText, onButtonClick }: { title: string; message: string; buttonText: string; onButtonClick: () => void }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4"
    >
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-gray-800">{title}</h2>
        <p className="text-center text-gray-600">{message}</p>
        <Button onClick={onButtonClick} className="w-full bg-red-600 hover:bg-red-700 text-white">
          {buttonText}
        </Button>
      </div>
      <div className="mt-4">
        {/* <LanguageSwitcher /> */}
      </div>
    </motion.div>
  );
};

const SidebarContent = ({ onClose, isDesktopSidebarOpen }: { onClose?: () => void; isDesktopSidebarOpen?: boolean }) => {
  const { user, logout, hasRole, isLoading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const theme = getRoleTheme(user?.user_role);

  const filteredNavItems = navItems.filter((item) =>
    hasRole(item.roles as any)
  );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="mb-4 text-2xl font-semibold text-sidebar-primary">{t("deliveryFlow")}</h2>
        <nav className="space-y-2">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              aria-current={location.pathname === item.path ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                location.pathname === item.path
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {isDesktopSidebarOpen && t(item.name)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-sidebar-border p-4">
        {user && (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {user.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isDesktopSidebarOpen && (
              <div className="flex-1">
                <div className="font-medium text-sidebar-foreground">{user.full_name}</div>
                <Badge
                  className={cn(
                    "mt-1 text-xs font-normal",
                    theme.bg.includes("amber") && "bg-amber-500 text-white",
                    theme.bg.includes("purple") && "bg-purple-500 text-white",
                    theme.bg.includes("blue") && "bg-blue-500 text-white",
                  )}
                >
                  {t(user.user_role)}
                </Badge>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              disabled={isLoading}
              aria-label={t("logout")}
            >
              <LogOutIcon className="h-5 w-5 text-foreground" />
            </Button>
          </div>
        )}
        <div className="mt-4">
          {/* <LanguageSwitcher /> */}
        </div>
      </div>
    </div>
  );
};

export const Layout = () => {
  const { user, isAuthenticated, isApproved, isPending, isRejected, logout, isLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  const theme = getRoleTheme(user?.user_role);

  useEffect(() => {
    if (!isLoading && isAuthenticated && isApproved && user && location.pathname === "/") {
      const firstAllowedPath = navItems.find((item) =>
        item.roles.includes(user.user_role),
      )?.path;
      if (firstAllowedPath) {
        navigate(firstAllowedPath, { replace: true });
      }
    }
  }, [isAuthenticated, isApproved, user, isLoading, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login", { replace: true });
    return null;
  }

  if (isPending) {
    return (
      <StatusCard
        title={t("awaitingApproval")}
        message={t("yourAccountIsPending")}
        buttonText={t("logout")}
        onButtonClick={logout}
      />
    );
  }

  if (isRejected) {
    return (
      <StatusCard
        title={t("accessDenied")}
        message={t("yourAccountWasRejected")}
        buttonText={t("exit")}
        onButtonClick={logout}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid min-h-screen w-full transition-all duration-300 ease-in-out",
        isDesktopSidebarOpen ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-[60px_1fr]",
        `bg-gradient-to-br ${theme.bg}`
      )}
    >
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out lg:block",
          isDesktopSidebarOpen ? "w-[280px]" : "w-[60px] overflow-hidden"
        )}
      >
        <SidebarContent isDesktopSidebarOpen={isDesktopSidebarOpen} />
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-sidebar-border bg-background px-4 lg:px-6">
          {/* Mobile Sidebar Trigger */}
          <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="outline" size="icon" className="shrink-0">
                <MenuIcon className="h-5 w-5 text-foreground" />
                <span className="sr-only">{t("toggleNavigationMenu")}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent onClose={() => setIsMobileSidebarOpen(false)} isDesktopSidebarOpen={true} />
            </SheetContent>
          </Sheet>

          {/* Desktop Sidebar Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setIsDesktopSidebarOpen(prev => !prev)}
            aria-label={t("toggleNavigationMenu")}
          >
            {isDesktopSidebarOpen ? (
              <PanelLeftOpenIcon className="h-5 w-5 text-foreground" />
            ) : (
              <PanelLeftCloseIcon className="h-5 w-5 text-foreground" />
            )}
          </Button>

          <h1 className="text-xl font-bold text-gray-800">{t("deliveryFlow")}</h1>

          <div className="ml-auto flex items-center gap-2">
            {/* <LanguageSwitcher /> */}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                disabled={isLoading}
                aria-label={t("logout")}
              >
                <LogOutIcon className="h-5 w-5 text-foreground" />
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};