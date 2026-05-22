"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { TicketAPI, Ticket, RestaurantAPI, Restaurant } from '@/lib/api';
import { showError, showSuccess, showInfo } from '@/utils/toast'; // Import showInfo
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCcwIcon, UtensilsCrossedIcon, MonitorIcon, CheckCircleIcon, ClockIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from '@/integrations/supabase/client';

export default function EcranEstafetaPage() {
  const { user, isAdmin, isRestaurante } = useAuth();
  const { t, i18n } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingTickets, setProcessingTickets] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string | null>(null); // State for double-click delete
  const doubleClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DOUBLE_CLICK_THRESHOLD = 500; // Milliseconds for double-click

  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [availableRestaurants, setAvailableRestaurants] = useState<Restaurant[]>([]);
  const [restaurantEcranEnabled, setRestaurantEcranEnabled] = useState<boolean>(false);

  useEffect(() => {
    const fetchRestaurants = async () => {
      if (isAdmin || isRestaurante) {
        try {
          const restaurantsList = await RestaurantAPI.list();
          setAvailableRestaurants(restaurantsList);
        } catch (err) {
          console.error("Failed to fetch restaurants:", err);
          showError(t("failedToLoadRestaurants"));
        }
      }
    };
    fetchRestaurants();
  }, [isAdmin, isRestaurante, t]);

  const fetchRestaurantEcranSetting = useCallback(async (restaurantId: string) => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('ecran_estafeta_enabled')
        .eq('id', restaurantId)
        .single();

      if (error) throw error;
      setRestaurantEcranEnabled(data?.ecran_estafeta_enabled || false);
    } catch (error) {
      console.error("Failed to fetch restaurant ecran setting:", error);
      showError(t("failedToLoadRestaurantSettings"));
      setRestaurantEcranEnabled(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.restaurant_id && isRestaurante) {
      setSelectedRestaurant(user.restaurant_id);
      fetchRestaurantEcranSetting(user.restaurant_id);
    } else if (isAdmin && selectedRestaurant !== "all") {
      fetchRestaurantEcranSetting(selectedRestaurant);
    } else if (isAdmin && selectedRestaurant === "all") {
      setRestaurantEcranEnabled(true); // Admin can always view
    }
  }, [user, isAdmin, isRestaurante, selectedRestaurant, fetchRestaurantEcranSetting]);

  const loadTickets = useCallback(async () => {
    if (!user || (!isAdmin && user.user_role === "restaurante" && !user.restaurant_id)) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      let fetchedTickets: Ticket[] = [];
      // Buscar todos os tickets ativos (PENDING e CONFIRMADO)
      const filter: Partial<Ticket> = { soft_deleted: false };

      if (isAdmin) {
        if (selectedRestaurant !== "all") {
          filter.restaurant_id = selectedRestaurant;
        }
        fetchedTickets = await TicketAPI.filter(filter, "created_date");
      } else if (user.user_role === "restaurante" && user.restaurant_id) {
        filter.restaurant_id = user.restaurant_id;
        fetchedTickets = await TicketAPI.filter(filter, "created_date");
      } else {
        fetchedTickets = [];
      }
      setTickets(fetchedTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      showError(t('failedToLoadActiveTickets'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isAdmin, t, selectedRestaurant]);

  useEffect(() => {
    loadTickets();

    // Configurar subscrição em tempo real
    const channel = supabase
      .channel('ecran-estafeta-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          console.log('Change received in EcranEstafeta, reloading tickets...');
          loadTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (doubleClickTimeoutRef.current) {
        clearTimeout(doubleClickTimeoutRef.current);
        doubleClickTimeoutRef.current = null;
      }
    };
  }, [loadTickets]);

  const handleSoftDelete = async (ticket: Ticket) => {
    if (!user) {
      showError(t("userNotAuthenticated"));
      return;
    }
    if (processingTickets.has(ticket.id)) return;

    setProcessingTickets(prev => new Set(prev).add(ticket.id));

    try {
      await TicketAPI.update(ticket.id, {
        soft_deleted: true,
        deleted_by_user_id: user.id,
        deleted_by_user_email: user.email,
        restaurant_id: ticket.restaurant_id,
      });

      showSuccess(t('ticketRemovedSuccessfully'));
      await loadTickets(); // Reload tickets to remove the deleted one from display
    } catch (error) {
      console.error('Error soft deleting ticket:', error);
      showError(t('failedToRemoveTicket'));
    } finally {
      setProcessingTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticket.id);
        return newSet;
      });
    }
  };

  const handleTicketClick = async (ticket: Ticket) => {
    if (!user) {
      showError(t("userNotAuthenticated"));
      return;
    }
    if (processingTickets.has(ticket.id)) return;

    if (pendingDelete === ticket.id) {
      if (doubleClickTimeoutRef.current) {
        clearTimeout(doubleClickTimeoutRef.current);
        doubleClickTimeoutRef.current = null;
      }
      await handleSoftDelete(ticket);
      setPendingDelete(null);
    } else {
      if (doubleClickTimeoutRef.current) {
        clearTimeout(doubleClickTimeoutRef.current);
        doubleClickTimeoutRef.current = null;
      }
      setPendingDelete(ticket.id);
      showInfo(t('clickAgainToRemove'));

      doubleClickTimeoutRef.current = setTimeout(() => {
        setPendingDelete(null);
        doubleClickTimeoutRef.current = null;
      }, DOUBLE_CLICK_THRESHOLD);
    }
  };

  const getTicketStatus = (ticket: Ticket) => {
    // No Ecrã Estafeta, tickets PENDING devem aparecer como CONFIRMADO/PRONTO
    // para o estafeta ver que o pedido foi recebido e está a ser processado.
    // O status real no backend e no balcão permanece PENDING.
    return {
      label: t('ordersReady'), // Sempre mostrar como "PEDIDO PRONTO" no ecrã do estafeta
      icon: CheckCircleIcon,
      className: 'bg-green-100 text-green-800 border-green-200',
      cardClass: 'border-green-300 bg-green-50',
      clickable: true,
      clickText: pendingDelete === ticket.id
        ? t('clickAgainToRemove')
        : t('clickToRemoveTicket')
    };
  };

  // Removido: currentRestaurantName não é mais necessário no título
  // const currentRestaurantName = isAdmin && selectedRestaurant !== "all"
  //   ? availableRestaurants.find(r => r.id === selectedRestaurant)?.name || selectedRestaurant
  //   : (isRestaurante && user?.restaurant_id
  //     ? availableRestaurants.find(r => r.id === user.restaurant_id)?.name || user.restaurant_id
  //     : null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="text-gray-700">{t('loadingTickets')}</span>
        </div>
      </div>
    );
  }

  if (isRestaurante && user?.restaurant_id && !restaurantEcranEnabled) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center p-4"
      >
        <MonitorIcon className="h-16 w-16 text-red-500 mb-4" />
        <h3 className="text-2xl font-bold text-gray-800">{t("ecranEstafetaDisabled")}</h3>
        <p className="text-lg text-gray-600">
          {t("ecranEstafetaDisabledMessage")}
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          {t("refreshPage")}
        </Button>
      </motion.div>
    );
  }

  if (!isAdmin && user?.user_role === "restaurante" && !user.restaurant_id) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center p-4"
      >
        <UtensilsCrossedIcon className="h-16 w-16 text-red-500 mb-4" />
        <h3 className="text-2xl font-bold text-gray-800">{t("restaurantIdMissing")}</h3>
        <p className="text-lg text-gray-600">
          {t("assignRestaurantIdMessage")}
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          {t("refreshPage")}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">
            {t('ecranEstafeta')}
            {/* Removido: currentRestaurantName não é mais exibido no título */}
          </h2>
          <p className="text-muted-foreground">
            {t('activeTicketsDescription', { count: tickets.length })}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t("selectRestaurant")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                {availableRestaurants.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={loadTickets}
            variant="outline"
            disabled={refreshing}
            className="space-x-2"
          >
            <RefreshCcwIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{t('refresh')}</span>
          </Button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <Card className="shadow-lg">
            <CardContent className="py-12">
              <MonitorIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2 text-gray-800">{t('noActiveTickets')}</h3>
              <p className="text-muted-foreground">
                {t('awaitingNewCodes')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {tickets.map((ticket, index) => {
              const status = getTicketStatus(ticket);
              const StatusIcon = status.icon;
              const isProcessing = processingTickets.has(ticket.id);
              const isPendingDelete = pendingDelete === ticket.id;

              return (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group"
                >
                  <Card
                    className={cn(
                      "h-full transition-all duration-200 border-2 relative cursor-pointer",
                      status.cardClass,
                      isPendingDelete ? 'ring-4 ring-red-500 shadow-xl' : 'hover:shadow-lg hover:scale-105',
                      isProcessing ? 'opacity-60 cursor-not-allowed' : '',
                      "flex flex-col"
                    )}
                    onClick={() => !isProcessing && handleTicketClick(ticket)}
                  >
                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10 rounded-lg">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      </div>
                    )}
                    <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="text-center">
                        <p className="text-4xl font-mono font-extrabold tracking-wider text-gray-900">
                          {ticket.code}
                        </p>
                      </div>

                      <div className="flex justify-center">
                        <Badge className={cn("px-3 py-1 text-sm font-semibold", status.className)}>
                          <StatusIcon className="h-4 w-4 mr-2" />
                          {status.label}
                        </Badge>
                      </div>

                      {/* Removido: status.clickable e status.clickText */}

                      {/* Removido: Detalhes de data/hora */}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}