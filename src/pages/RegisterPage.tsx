"use client";

import React from "react";
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

const RegisterPage = () => {
  const { isAuthenticated, isApproved, user, isLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && !isApproved) {
      navigate("/", { replace: true });
    } else if (isAuthenticated && isApproved && user) {
      const firstPath = user.user_role === 'admin' ? '/admin/users' :
                        user.user_role === 'restaurante' ? '/balcao' :
                        '/estafeta';
      navigate(firstPath, { replace: true });
    }
  }, [isAuthenticated, isApproved, user, isLoading, navigate]);

  if (isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4"
    >
      <div className="w-full max-w-md">
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#3b82f6',
                  brandAccent: '#1d4ed8',
                },
              },
            },
          }}
          theme="light"
          providers={[]}
          view="sign_up"
          redirectTo={window.location.origin + '/'}
        />
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            {t("alreadyHaveAccount")}{" "}
            <a href="/" className="text-blue-500 hover:underline">
              {t("backToLogin")}
            </a>
          </p>
        </div>
      </div>
      <div className="mt-4">
        <LanguageSwitcher />
      </div>
    </motion.div>
  );
};

export default RegisterPage;