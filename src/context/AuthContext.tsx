import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, UserAPI, UserRole, UserStatus, signInWithPassword, signUp, signOut as supabaseSignOut } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import { useTranslation } from "react-i18next";

export type { UserRole };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isApproved: boolean;
  isPending: boolean;
  isRejected: boolean;
  isAdmin: boolean;
  isRestaurante: boolean;
  isEstafeta: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  canAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const rolePaths: Record<UserRole, string[]> = {
  admin: ["/analise-tempo", "/balcao", "/estafeta", "/historico", "/admin/users", "/ecran-estafeta"],
  restaurante: ["/balcao", "/historico", "/ecran-estafeta"],
  estafeta: ["/estafeta"],
};

export const SessionContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  const loadUser = useCallback(async (sessionUser: any, event?: string) => {
    console.log(`[AuthContext] loadUser called. Event: ${event}, SessionUser:`, sessionUser);
    setIsLoading(true);
    try {
      if (sessionUser) {
        const currentUser = await UserAPI.me();
        if (currentUser) {
          setUser(currentUser);
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            showSuccess(t("welcomeUser", { userName: currentUser.full_name }));
          }
          console.log("[AuthContext] User loaded:", currentUser);
        } else {
          setUser(null);
          showError(t("failedToLoadUserProfile"));
          console.warn("[AuthContext] Session user exists, but profile not found.");
        }
      } else {
        setUser(null);
        if (event === 'SIGNED_OUT') {
          showSuccess(t("sessionEnded"));
        }
        console.log("[AuthContext] No session user or signed out.");
      }
    } catch (error) {
      console.error("[AuthContext] Error fetching user profile or session:", error);
      showError(t("authErrorOccurred"));
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log("[AuthContext] isLoading set to false.");
    }
  }, [t, showSuccess, showError]);

  useEffect(() => {
    let isMounted = true;

    const getInitialSession = async () => {
      setIsLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("[AuthContext] Error getting initial session:", error);
        showError(t("authErrorOccurred"));
        setUser(null);
      } else {
        loadUser(session?.user, 'INITIAL_LOAD');
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      console.log("[AuthContext] Auth state change detected. Event:", event, "Session:", session);
      loadUser(session?.user, event);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      console.log("[AuthContext] Auth state change subscription unsubscribed.");
    };
  }, [loadUser, t]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await UserAPI.login(email, password);
    } catch (error) {
      showError(t("loginFailed"));
      throw error;
    } finally {
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      await UserAPI.register(fullName, email, password);
    } catch (error: any) {
      if (error.message?.includes('already registered')) {
        showError(t("emailAlreadyExists"));
      } else {
        showError(t("registrationFailed"));
      }
      throw error;
    } finally {
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabaseSignOut();
    } catch (error) {
      showError(t("failedToLogout"));
      throw error;
    } finally {
    }
  };

  const isAuthenticated = !!user;
  const isApproved = user?.status === "APPROVED";
  const isPending = user?.status === "PENDING";
  const isRejected = user?.status === "REJECTED";

  const isAdmin = user?.user_role === "admin";
  const isRestaurante = user?.user_role === "restaurante";
  const isEstafeta = user?.user_role === "estafeta";

  const hasRole = useCallback(
    (roles: UserRole[]) => {
      return isAuthenticated && isApproved && user ? roles.includes(user.user_role) : false;
    },
    [user, isAuthenticated, isApproved],
  );

  const canAccess = useCallback(
    (path: string) => {
      if (!isAuthenticated || !isApproved || !user) return false;
      
      const allowedPaths = rolePaths[user.user_role as UserRole];
      return allowedPaths && allowedPaths.includes(path);
    },
    [user, isAuthenticated, isApproved],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        isAuthenticated,
        isApproved,
        isPending,
        isRejected,
        isAdmin,
        isRestaurante,
        isEstafeta,
        hasRole,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a SessionContextProvider");
  }
  return context;
};