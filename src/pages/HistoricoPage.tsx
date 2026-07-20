"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { TicketAPI, Ticket, UserAPI, RestaurantAPI, Restaurant } from "@/lib/api";
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
import { HistoryIcon, RefreshCwIcon, Undo2Icon, CheckCircleIcon, ClockIcon, CalendarIcon, ArrowUpDown, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker, DateRange } from "@/components/DateRangePicker";

interface SortConfig {
  key: 'code' | 'status' | 'created_by_user_email' | 'deleted_at' | 'pendingTime' | 'restaurantName';
  direction: 'asc' | 'desc';
}

interface TicketWithPendingTime extends Ticket {
  pendingTimeValue: number;
  restaurantNameDisplay: string;
}

const getPendingDuration = (ticket: Ticket, t: any): { display: string; value: number } => {
  const createdDate = parseISO(ticket.created_date);
  let endDate: Date | null = null;

  if (ticket.status === "CONFIRMADO" && ticket.acknowledged_at) {
    endDate = parseISO(ticket.acknowledged_at);
  } else if (ticket.soft_deleted && ticket.deleted_at) {
    endDate = parseISO(ticket.deleted_at);
  } else if (ticket.soft_deleted) {
    endDate = new Date();
  }

  const totalMinutes = endDate ? differenceInMinutes(endDate, createdDate) : 0;
  const absoluteMinutes = Math.max(0, totalMinutes);

  if (absoluteMinutes < 1) {
    return { display: t("lessThanOneMin"), value: absoluteMinutes };
  }

  const days = Math.floor(absoluteMinutes / (24 * 60));
  const hours = Math.floor((absoluteMinutes % (24 * 60)) / 60);
  const minutes = absoluteMinutes % 60;

  let parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);

  return { display: parts.length > 0 ? parts.join(" ") : "0min", value: absoluteMinutes };
};

const formatDateWithWeekday = (dateString: string, locale: any) => {
  const date = parseISO(dateString);
  return format(date, "dd/MM/yyyy (EEEE) HH:mm", { locale });
};

const HistoricoPage = () => {
  const { user, isAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const [deletedTickets, setDeletedTickets] = useState<TicketWithPendingTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [availableRestaurants, setAvailableRestaurants] = useState<Restaurant[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'deleted_at', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("month"); // today, week, month, all, custom
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfMonth(new Date()), to: new Date() });

  // Recalcula o intervalo de datas quando o período rápido muda
  useEffect(() => {
    const today = new Date();
    switch (selectedPeriod) {
      case "today":
        setDateRange({ from: startOfDay(today), to: endOfDay(today) });
        break;
      case "week":
        setDateRange({ from: startOfWeek(today, { weekStartsOn: 0 }), to: endOfDay(today) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(today), to: endOfDay(today) });
        break;
      case "all":
        setDateRange({ from: undefined, to: undefined });
        break;
      case "custom":
        // Mantém o intervalo escolhido no calendário
        break;
    }
  }, [selectedPeriod]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range || { from: undefined, to: undefined });
  };

  useEffect(() => {
    const fetchRestaurants = async () => {
      if (isAdmin) {
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
  }, [isAdmin, t]);

  const getRestaurantNameForTicket = useCallback((restaurantId: string | undefined) => {
    if (!restaurantId) return t("none");
    const restaurant = availableRestaurants.find(r => r.id === restaurantId);
    return restaurant ? restaurant.name : `Restaurante ${restaurantId.substring(0, 4)}`;
  }, [availableRestaurants, t]);

  const fetchDeletedTickets = useCallback(async () => {
    setLoading(true);
    try {
      let tickets: Ticket[];
      const filter: Partial<Ticket> = { soft_deleted: true };
      const dateFilter = {
        from: dateRange.from ? startOfDay(dateRange.from) : undefined,
        to: dateRange.to ? endOfDay(dateRange.to) : undefined,
        field: 'deleted_at' as const,
      };

      if (isAdmin) {
        if (selectedRestaurant !== "all") {
          filter.restaurant_id = selectedRestaurant;
        }
        tickets = await TicketAPI.filter(filter, "-deleted_at", undefined, dateFilter);
      } else if (user?.user_role === "restaurante" && user.restaurant_id) {
        filter.restaurant_id = user.restaurant_id;
        tickets = await TicketAPI.filter(filter, "-deleted_at", undefined, dateFilter);
      } else {
        tickets = [];
      }

      const ticketsWithPendingTime: TicketWithPendingTime[] = tickets.map(ticket => ({
        ...ticket,
        pendingTimeValue: getPendingDuration(ticket, t).value,
        restaurantNameDisplay: getRestaurantNameForTicket(ticket.restaurant_id),
      }));

      if (sortConfig) {
        ticketsWithPendingTime.sort((a, b) => {
          let aValue: any;
          let bValue: any;

          switch (sortConfig.key) {
            case 'pendingTime':
              aValue = a.pendingTimeValue;
              bValue = b.pendingTimeValue;
              break;
            case 'deleted_at':
              aValue = a.deleted_at ? parseISO(a.deleted_at).getTime() : 0;
              bValue = b.deleted_at ? parseISO(b.deleted_at).getTime() : 0;
              break;
            case 'created_by_user_email':
              aValue = a.created_by_user_email || '';
              bValue = b.created_by_user_email || '';
              break;
            case 'status':
              aValue = a.status;
              bValue = b.status;
              break;
            case 'code':
              aValue = a.code;
              bValue = b.code;
              break;
            case 'restaurantName':
              aValue = a.restaurantNameDisplay;
              bValue = b.restaurantNameDisplay;
              break;
            default:
              aValue = 0;
              bValue = 0;
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      setDeletedTickets(ticketsWithPendingTime);
    } catch (error) {
      console.error("Failed to fetch deleted tickets:", error);
      showError(t("failedToLoadHistory"));
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, t, sortConfig, getRestaurantNameForTicket, selectedRestaurant, dateRange]);

  useEffect(() => {
    fetchDeletedTickets();
  }, [fetchDeletedTickets]);

  const handleRestoreTicket = async (ticketId: string) => {
    if (!user) {
      showError(t("userNotAuthenticated"));
      return;
    }
    setActionLoading(ticketId);
    try {
      await TicketAPI.update(ticketId, { soft_deleted: false, restaurant_id: deletedTickets.find(t => t.id === ticketId)?.restaurant_id });
      showSuccess(t("ticketRestoredSuccessfully"));
      fetchDeletedTickets();
    } catch (error) {
      console.error("Failed to restore ticket:", error);
      showError(t("failedToRestoreTicket"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prevConfig => {
      if (prevConfig?.key === key) {
        return { ...prevConfig, direction: prevConfig.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <HistoryIcon className="h-8 w-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-800">{t("ticketHistory")}</h2>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="icon" onClick={fetchDeletedTickets} disabled={loading}>
            <RefreshCwIcon className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            <span className="sr-only">{t("refresh")}</span>
          </Button>
        </div>
      </div>

      {/* Filtro de Período */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">{t("selectPeriod")}:</span>
          {(["today", "week", "month", "all", "custom"] as const).map((period) => (
            <Button
              key={period}
              size="sm"
              variant={selectedPeriod === period ? "default" : "outline"}
              onClick={() => setSelectedPeriod(period)}
            >
              {t(period)}
            </Button>
          ))}
          {selectedPeriod === "custom" && (
            <DateRangePicker dateRange={dateRange} onChange={handleDateRangeChange} />
          )}
        </div>
      </Card>

      {/* Barra de Pesquisa */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={t("searchByCodeEmailOrRestaurant") || "Pesquisar por código, email ou restaurante..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{t("removedTickets")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-t-transparent"></div>
            </div>
          ) : deletedTickets.length === 0 ? (
            <p className="text-center text-gray-500">{t("noRemovedTickets")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('code')} className="p-0 h-auto">
                        {t("code")}
                        <ArrowUpDown className={cn("ml-2 h-4 w-4", sortConfig?.key === 'code' && sortConfig.direction === 'desc' && 'rotate-180')} />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('status')} className="p-0 h-auto">
                        {t("status")}
                        <ArrowUpDown className={cn("ml-2 h-4 w-4", sortConfig?.key === 'status' && sortConfig.direction === 'desc' && 'rotate-180')} />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('restaurantName')} className="p-0 h-auto">
                        {t("restaurantName")}
                        <ArrowUpDown className={cn("ml-2 h-4 w-4", sortConfig?.key === 'restaurantName' && sortConfig.direction === 'desc' && 'rotate-180')} />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('created_by_user_email')} className="p-0 h-auto">
                        {t("createdBy")}
                        <ArrowUpDown className={cn("ml-2 h-4 w-4", sortConfig?.key === 'created_by_user_email' && sortConfig.direction === 'desc' && 'rotate-180')} />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('deleted_at')} className="p-0 h-auto">
                        {t("removedAt")}
                        <ArrowUpDown className={cn("ml-2 h-4 w-4", sortConfig?.key === 'deleted_at' && sortConfig.direction === 'desc' && 'rotate-180')} />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" onClick={() => handleSort('pendingTime')} className="p-0 h-auto">
                        {t("pendingTime")}
                        <ArrowUpDown className={cn("ml-2 h-4 w-4", sortConfig?.key === 'pendingTime' && sortConfig.direction === 'desc' && 'rotate-180')} />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedTickets
                    .filter(ticket => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        ticket.code?.toLowerCase().includes(q) ||
                        ticket.created_by_user_email?.toLowerCase().includes(q) ||
                        ticket.restaurantNameDisplay?.toLowerCase().includes(q)
                      );
                    })
                    .map((ticket) => {
                      const showDeletionDate = ticket.deleted_at;
                      const dateToShow = showDeletionDate ? ticket.deleted_at : ticket.created_date;
                      const isFallbackDate = !showDeletionDate;
                      const formattedDate = formatDateWithWeekday(dateToShow, i18n.language === 'pt' ? ptBR : undefined);

                      return (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.code}</TableCell>
                          <TableCell>
                            {ticket.status === "PENDING" ? (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                <ClockIcon className="mr-1 h-3 w-3" /> {t("pending")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-100 text-green-800">
                                <CheckCircleIcon className="mr-1 h-3 w-3" /> {t("ready")}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{getRestaurantNameForTicket(ticket.restaurant_id)}</TableCell>
                          <TableCell>{ticket.created_by_user_email}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                            <span>{formattedDate}</span>
                            {isFallbackDate && (
                              <Badge variant="secondary" className="text-xs">
                                {t("created")}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{getPendingDuration(ticket, t).display}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreTicket(ticket.id)}
                              disabled={actionLoading === ticket.id}
                            >
                              <Undo2Icon className="mr-2 h-4 w-4" />
                              {actionLoading === ticket.id ? t("restoring") : t("restore")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default HistoricoPage;