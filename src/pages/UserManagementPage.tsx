"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { UserAPI, User, UserStatus, UserRole, RestaurantAPI, Restaurant } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UsersIcon, CheckCircleIcon, XCircleIcon, RefreshCcwIcon, PlusCircleIcon, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext"; // Adicionado: Importação do useAuth

const UserManagementPage = React.memo(() => {
  const { user: currentUser, isAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [isAddRestaurantDialogOpen, setIsAddRestaurantDialogOpen] = useState(false);
  const [newRestaurantId, setNewRestaurantId] = useState("");
  const [newRestaurantName, setNewRestaurantName] = useState("");

  const { data: users, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<User[], Error>({
    queryKey: ["allUsers"],
    queryFn: async () => {
      if (!isAdmin) return [];
      return UserAPI.filter({}, "-created_date");
    },
    enabled: isAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const { data: restaurants, isLoading: isLoadingRestaurants, refetch: refetchRestaurants } = useQuery<Restaurant[], Error>({
    queryKey: ["allRestaurants"],
    queryFn: async () => {
      return RestaurantAPI.list();
    },
    staleTime: 1000 * 60 * 10,
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async (variables: { userId: string; status: UserStatus }) => {
      if (!isAdmin) throw new Error(t("permissionDenied"));
      return UserAPI.update(variables.userId, { status: variables.status });
    },
    onSuccess: (data, variables) => {
      showSuccess(t("userStatusUpdated", { status: variables.status }));
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (error) => {
      console.error("Failed to update user status:", error);
      showError(t("failedToUpdateUserStatus"));
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async (variables: { userId: string; role: UserRole }) => {
      if (!isAdmin) throw new Error(t("permissionDenied"));
      return UserAPI.update(variables.userId, { user_role: variables.role });
    },
    onSuccess: (data, variables) => {
      showSuccess(t("userRoleUpdated", { role: variables.role }));
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (error) => {
      console.error("Failed to update user role:", error);
      showError(t("failedToUpdateUserRole"));
    }
  });

  const updateUserRestaurantIdMutation = useMutation({
    mutationFn: async (variables: { userId: string; restaurantId: string | null }) => {
      if (!isAdmin) throw new Error(t("permissionDenied"));
      return UserAPI.update(variables.userId, { restaurant_id: variables.restaurantId });
    },
    onSuccess: () => {
      showSuccess(t("userRestaurantIdUpdated"));
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    },
    onError: (error) => {
      console.error("Failed to update user restaurant ID:", error);
      showError(t("failedToUpdateUserRestaurantId"));
    }
  });

  const addRestaurantMutation = useMutation({
    mutationFn: async (variables: { id: string; name: string }) => {
      return RestaurantAPI.create(variables.id, variables.name);
    },
    onSuccess: () => {
      showSuccess(t("restaurantAddedSuccessfully"));
      setIsAddRestaurantDialogOpen(false);
      setNewRestaurantId("");
      setNewRestaurantName("");
      queryClient.invalidateQueries({ queryKey: ["allRestaurants"] });
    },
    onError: (error: any) => {
      console.error("Failed to add restaurant:", error); // Log do erro completo
      if (error.statusCode === 409) {
        showError(t("restaurantIdAlreadyExists"));
      } else {
        showError(t("failedToAddRestaurant"));
      }
    }
  });

  const handleUpdateUserStatus = useCallback((userId: string, status: UserStatus) => {
    updateUserStatusMutation.mutate({ userId, status });
  }, [updateUserStatusMutation]);

  const handleUpdateUserRole = useCallback((userId: string, role: UserRole) => {
    updateUserRoleMutation.mutate({ userId, role });
  }, [updateUserRoleMutation]);

  const handleUpdateRestaurantId = useCallback((userId: string, newRestaurantId: string | null) => {
    updateUserRestaurantIdMutation.mutate({ userId, restaurantId: newRestaurantId === "unassigned" ? null : newRestaurantId });
  }, [updateUserRestaurantIdMutation]);

  const handleAddRestaurant = useCallback(async () => {
    console.log("Attempting to add restaurant with ID:", newRestaurantId, "and Name:", newRestaurantName); // Adicionado log
    if (!newRestaurantId.trim() || !newRestaurantName.trim()) {
      showError(t("pleaseFillAllFields"));
      return;
    }
    addRestaurantMutation.mutate({ id: newRestaurantId.trim(), name: newRestaurantName.trim() });
  }, [newRestaurantId, newRestaurantName, addRestaurantMutation, t]);

  const getStatusBadge = useCallback((status: UserStatus) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{t("pending")}</Badge>;
      case "APPROVED":
        return <Badge variant="outline" className="bg-green-100 text-green-800">{t("approved")}</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-red-100 text-red-800">{t("rejected")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }, [t]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-xl text-gray-600">{t("accessDeniedAdminOnly")}</p>
      </div>
    );
  }

  const isAnyActionLoading = updateUserStatusMutation.isPending || updateUserRoleMutation.isPending || updateUserRestaurantIdMutation.isPending || addRestaurantMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 w-full"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <UsersIcon className="h-8 w-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-800">{t("userManagement")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsAddRestaurantDialogOpen(true)}>
            <PlusCircleIcon className="mr-2 h-4 w-4" /> {t("addRestaurant")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => { refetchUsers(); refetchRestaurants(); }} disabled={isLoadingUsers || isLoadingRestaurants}>
            <RefreshCcwIcon className={(isLoadingUsers || isLoadingRestaurants) ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            <span className="sr-only">{t("refresh")}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{t("allUsers")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-t-transparent"></div>
            </div>
          ) : users?.length === 0 ? (
            <p className="text-center text-gray-500">{t("noUsersFound")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("fullName")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("role")}</TableHead>
                    <TableHead>{t("restaurantId")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("createdAt")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.user_role}
                          onValueChange={(value: UserRole) => handleUpdateUserRole(user.id, value)}
                          disabled={isAnyActionLoading || user.id === currentUser?.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder={t("selectRole")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="estafeta">{t("courier")}</SelectItem>
                            <SelectItem value="restaurante">{t("restaurant")}</SelectItem>
                            <SelectItem value="admin">{t("admin")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {(user.user_role === "restaurante" || user.user_role === "estafeta" || user.user_role === "admin") ? (
                          <Select
                            value={user.restaurant_id || "unassigned"}
                            onValueChange={(value: string) => handleUpdateRestaurantId(user.id, value)}
                            disabled={isAnyActionLoading}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder={t("selectRestaurantId")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">{t("none")}</SelectItem>
                              {restaurants?.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.name} ({r.id})</SelectItem>
                              ))}
                              {!restaurants?.some(r => r.id === user.restaurant_id) && user.restaurant_id && (
                                <SelectItem value={user.restaurant_id}>{user.restaurant_id} (current)</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          user.restaurant_id || "N/A"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        {format(parseISO(user.created_date), "dd/MM/yyyy HH:mm", { locale: i18n.language === 'pt' ? ptBR : undefined })}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {user.status !== "APPROVED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateUserStatus(user.id, "APPROVED")}
                            disabled={isAnyActionLoading}
                          >
                            {updateUserStatusMutation.isPending && updateUserStatusMutation.variables?.userId === user.id && updateUserStatusMutation.variables?.status === "APPROVED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircleIcon className="mr-2 h-4 w-4" />} {t("approve")}
                          </Button>
                        )}
                        {user.status !== "REJECTED" && user.id !== currentUser?.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleUpdateUserStatus(user.id, "REJECTED")}
                            disabled={isAnyActionLoading}
                          >
                            {updateUserStatusMutation.isPending && updateUserStatusMutation.variables?.userId === user.id && updateUserStatusMutation.variables?.status === "REJECTED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircleIcon className="mr-2 h-4 w-4" />} {t("reject")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddRestaurantDialogOpen} onOpenChange={setIsAddRestaurantDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" aria-labelledby="add-restaurant-dialog-title">
          <DialogHeader>
            <DialogTitle id="add-restaurant-dialog-title">{t("addRestaurant")}</DialogTitle>
            <DialogDescription>
              {t("addRestaurantDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="restaurantId" className="text-right">
                {t("restaurantId")}
              </Label>
              <Input
                id="restaurantId"
                value={newRestaurantId}
                onChange={(e) => setNewRestaurantId(e.target.value)}
                className="col-span-3"
                disabled={addRestaurantMutation.isPending}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="restaurantName" className="text-right">
                {t("restaurantName")}
              </Label>
              <Input
                id="restaurantName"
                value={newRestaurantName}
                onChange={(e) => setNewRestaurantName(e.target.value)}
                className="col-span-3"
                disabled={addRestaurantMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleAddRestaurant} 
              disabled={addRestaurantMutation.isPending || !newRestaurantId.trim() || !newRestaurantName.trim()}
            >
              {addRestaurantMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircleIcon className="mr-2 h-4 w-4" />
              )}
              {t("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
});

export default UserManagementPage;