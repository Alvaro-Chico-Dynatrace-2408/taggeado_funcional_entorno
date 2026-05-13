import React, { useState, useEffect, useCallback } from "react";
import { TextInput } from "@dynatrace/strato-components/forms";
import { Flex } from "@dynatrace/strato-components/layouts";

interface SearchBarProps {
  onSearch: (term: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export const SearchBar = ({
  onSearch,
  placeholder = "Buscar entidad por nombre...",
  debounceMs = 300,
}: SearchBarProps) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim().length >= 2) {
        onSearch(value.trim());
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs, onSearch]);

  return (
    <Flex style={{ maxWidth: 500 }}>
      <TextInput
        value={value}
        onChange={(val) => setValue(val ?? "")}
        placeholder={placeholder}
      />
    </Flex>
  );
};
