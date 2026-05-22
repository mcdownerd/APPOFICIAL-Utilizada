"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlobeIcon } from "lucide-react";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  // Não é mais necessário mudar a língua se só há uma
  // const changeLanguage = (lng: string) => {
  //   i18n.changeLanguage(lng);
  // };

  return (
    <div className="flex items-center gap-2">
      <GlobeIcon className="h-5 w-5 text-sidebar-foreground" />
      <Select value={i18n.language} onValueChange={() => {}} disabled> {/* Desativado e sem onValueChange */}
        <SelectTrigger className="w-[120px] bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
          <SelectValue placeholder="Idioma" />
        </SelectTrigger>
        <SelectContent className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
          <SelectItem value="pt">Português</SelectItem>
          {/* <SelectItem value="en">English</SelectItem> */} {/* Removido */}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSwitcher;