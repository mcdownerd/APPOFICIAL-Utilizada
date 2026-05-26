"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { TicketAPI, Ticket } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TruckIcon, ClockIcon, CheckCircleIcon, SendIcon, Trash2Icon, Loader2 } from 'lucide-react';
import { motion } from "framer-motion";
import { parseISO, isPast, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

const EstafetaPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);
  const [processingRecentDelete, setProcessingRecentDelete] = useState<string | null>(null); // Novo estado para gerenciar o carregamento da exclusão

  useEffect(() => {
    console.log("EstafetaPage: User restaurant_id:", user?.restaurant_id);
  }, [user?.restaurant_id]);

  const fetchRecentTickets = useCallback(async () => {
    if (!user) return;
    try {
      const allUserTickets = await TicketAPI.filter(
        { created_by_user_id: user.id, soft_deleted: undefined },
        "-created_date",
      );

      const ticketsToDisplay: Ticket[] = [];
      allUserTickets.forEach(ticket => {
        if (ticket.soft_deleted) {
          if (ticket.deleted_at) {
            const deletedAtDate = parseISO(ticket.deleted_at);
            const oneMinuteAfterDeletion = addMinutes(deletedAtDate, 1);
            if (isPast(oneMinuteAfterDeletion)) {
              return;
            }
          } else {
            return;
          }
        }
        ticketsToDisplay.push(ticket);
      });

      ticketsToDisplay.sort((a, b) => {
        const aIsConfirmed = a.status === "CONFIRMADO" && !a.soft_deleted;
        const bIsConfirmed = b.status === "CONFIRMADO" && !b.soft_deleted;
        const aIsPending = a.status === "PENDING" && !a.soft_deleted;
        const bIsPending = b.status === "PENDING" && !b.soft_deleted;

        // Prioridade 1: CONFIRMADO (não soft-deleted)
        if (aIsConfirmed && !bIsConfirmed) return -1;
        if (!aIsConfirmed && bIsConfirmed) return 1;

        // Prioridade 2: PENDENTE (não soft-deleted)
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;

        // Prioridade 3: Soft-deleted (vem depois dos ativos)
        if (!a.soft_deleted && b.soft_deleted) return -1;
        if (a.soft_deleted && !b.soft_deleted) return 1;

        // Ordenação secundária: por data (mais recente primeiro)
        let dateA: Date;
        let dateB: Date;

        if (a.soft_deleted && b.soft_deleted) {
          dateA = a.deleted_at ? parseISO(a.deleted_at) : new Date(0);
          dateB = b.deleted_at ? parseISO(b.deleted_at) : new Date(0);
        } else {
          dateA = parseISO(a.created_date);
          dateB = parseISO(b.created_date);
        }

        return dateB.getTime() - dateA.getTime(); // Ordem decrescente (mais recente primeiro)
      });

      setRecentTickets(ticketsToDisplay.slice(0, 7));
    } catch (error) {
      console.error("Failed to fetch recent tickets:", error);
      showError(t("failedToLoadRecentTickets"));
    }
  }, [user, t]);

  const fetchPendingTicketsCount = useCallback(async () => {
    try {
      setPendingTicketsCount(0);
    } catch (error) {
      console.error("Failed to fetch pending tickets count:", error);
      showError(t("pendingTicketsCountFailed"));
    }
  }, [t, user?.restaurant_id]);

  // Ref para sempre ter a versão mais recente de fetchRecentTickets sem recriar o canal
  const fetchRecentTicketsRef = useRef(fetchRecentTickets);
  useEffect(() => {
    fetchRecentTicketsRef.current = fetchRecentTickets;
  }, [fetchRecentTickets]);

  // Carregar tickets quando as dependências mudam
  useEffect(() => {
    fetchRecentTickets();
  }, [fetchRecentTickets]);

  // Subscrição Realtime — criada apenas uma vez
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('estafeta-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `created_by=eq.${user.id}`
        },
        (payload) => {
          console.log('[Estafeta Realtime] Change received:', payload);
          fetchRecentTicketsRef.current();
        }
      )
      .subscribe((status) => {
        console.log('[Estafeta Realtime] Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPendingTicketsCount();
  }, [fetchPendingTicketsCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 4 || isSubmitting) return;
    if (!user?.restaurant_id) {
      showError(t("userNotAssignedToRestaurant"));
      return;
    }

    setIsSubmitting(true);
    try {
      await TicketAPI.create({ code, restaurant_id: user.restaurant_id, status: "PENDING" }); // Alterado para PENDING
      showSuccess(t("codeSentSuccessfully", { code }));
      setCode("");
      fetchRecentTickets();
      fetchPendingTicketsCount();
    } catch (error: any) {
      if (error.statusCode === 409) {
        showError(t("codeAlreadyExists"));
      } else if (error.statusCode === 429) {
        showError(t("tooManyRequests"));
      } else {
        showError(t("failedToSendCode"));
      }
      console.error("Error creating ticket:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDeleteRecentTicket = async (ticket: Ticket) => {
    if (!user || processingRecentDelete === ticket.id) return;

    setProcessingRecentDelete(ticket.id);
    try {
      await TicketAPI.update(ticket.id, {
        soft_deleted: true,
        deleted_by_user_id: user.id,
        deleted_by_user_email: user.email,
        restaurant_id: ticket.restaurant_id,
      });
      showSuccess(t('ticketRemovedSuccessfully'));
      fetchRecentTickets(); // Re-fetch recent tickets to update the list
    } catch (error) {
      console.error('Error soft deleting recent ticket:', error);
      showError(t('failedToRemoveTicket'));
    } finally {
      setProcessingRecentDelete(null);
    }
  };

  const isCodeValid = code.length === 4 && /^[A-Z0-9]{4}$/.test(code);
  const canSubmit = isCodeValid && !isSubmitting && !!user?.restaurant_id;

  console.log("EstafetaPage: canSubmit:", canSubmit);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      <div className="flex flex-col items-center space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="p-3 rounded-full bg-gradient-to-r from-estafeta to-estafeta-dark text-white mb-2">
            <TruckIcon className="h-8 w-8" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">{t("courierCenter")}</h2>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg sm:text-xl md:text-2xl">{t("sendNewCode")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="text"
                placeholder="XXXX"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                className="text-xl sm:text-2xl text-center font-mono tracking-widest border-estafeta focus:ring-estafeta-dark focus:border-estafeta-dark"
                disabled={isSubmitting || !user?.restaurant_id}
              />
              <p className="text-sm text-gray-500 text-center">{t("fourCharactersHint")}</p>
              {!user?.restaurant_id && (
                <p className="text-sm text-red-600 text-center font-medium">
                  {t("userNotAssignedToRestaurant")}
                </p>
              )}
              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-gradient-to-r from-estafeta to-estafeta-dark text-white hover:from-estafeta-dark hover:to-estafeta"
              >
                {isSubmitting ? (
                  t("sending")
                ) : (
                  <>
                    <SendIcon className="mr-2 h-4 w-4" /> {t("sendCode")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="w-full flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-row items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-lg sm:text-xl md:text-2xl">{t("lastSevenCodesSent")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <p className="text-center text-gray-500">{t("noRecentCodes")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentTickets.map((ticket) => {
                  const isTicketProcessing = processingRecentDelete === ticket.id;
                  const isSoftDeleted = ticket.soft_deleted;

                  return (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 shadow-sm relative",
                        isSoftDeleted ? "bg-blue-50 border-blue-200" :
                          ticket.status === "CONFIRMADO" ? "bg-green-50 border-green-200" :
                            "bg-yellow-50 border-yellow-200",
                        isTicketProcessing && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <Badge
                        className={cn(
                          "text-base font-bold px-3 py-1",
                          isSoftDeleted ? "bg-blue-200 text-blue-900" :
                            ticket.status === "CONFIRMADO" ? "bg-green-200 text-green-900" :
                              "bg-yellow-200 text-yellow-900"
                        )}
                      >
                        {ticket.code}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {isSoftDeleted ? (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            <CheckCircleIcon className="mr-1 h-3 w-3" /> {t("ready")}
                          </Badge>
                        ) : ticket.status === "CONFIRMADO" ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            <CheckCircleIcon className="mr-1 h-3 w-3" /> {t("acknowledged")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                            <ClockIcon className="mr-1 h-3 w-3" /> {t("pending")}
                          </Badge>
                        )}
                        {!isSoftDeleted && ticket.status === "CONFIRMADO" && ( // Mostrar botão de apagar apenas se não estiver soft-deleted e status for CONFIRMADO
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 transition-opacity duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSoftDeleteRecentTicket(ticket);
                            }}
                            disabled={isTicketProcessing}
                            aria-label={t('removeTicket')}
                          >
                            {isTicketProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2Icon className="h-5 w-5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default EstafetaPage;