import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { HomeIcon, TruckIcon, UtensilsCrossedIcon, BarChart3Icon, HistoryIcon, UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const navItems = [
  { path: "/estafeta", roles: ["estafeta", "admin"] },
  { path: "/balcao", roles: ["restaurante", "admin"] },
  { path: "/historico", roles: ["restaurante", "admin"] },
  { path: "/analise-tempo", roles: ["admin", "restaurante"] },
  { path: "/admin/users", roles: ["admin"] },
];

const Index = () => {
  const { isAuthenticated, isApproved, user, isLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated && isApproved && user) {
      const firstAllowedPath = navItems.find((item) =>
        item.roles.includes(user.user_role),
      )?.path;
      if (firstAllowedPath) {
        navigate(firstAllowedPath, { replace: true });
      }
    }
  }, [isAuthenticated, isApproved, user, isLoading, navigate]);

  if (isLoading || !isAuthenticated || !isApproved || !user) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4"
    >
      <HomeIcon className="h-16 w-16 text-blue-500 mb-4" />
      <h1 className="text-4xl font-bold text-gray-800 mb-2">{t("welcomeToDeliveryFlow")}</h1>
      <p className="text-xl text-gray-600">
        {t("helloUser", { userName: user.full_name })}
      </p>
    </motion.div>
  );
};

export default Index;