import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ConferenceOption } from '../types/schema';

interface SelectedOption {
  option: ConferenceOption;
  quantity: number;
}

interface UsePricingResult {
  basePrice: number;
  selectedOptions: SelectedOption[];
  totalPrice: number;
  optionsTotal: number;
  setBasePrice: (price: number) => void;
  toggleOption: (option: ConferenceOption, quantity?: number) => void;
  updateOptionQuantity: (optionId: string, quantity: number) => void;
  clearOptions: () => void;
  isOptionSelected: (optionId: string) => boolean;
  getOptionQuantity: (optionId: string) => number;
}

export const usePricing = (initialBasePrice: number = 0): UsePricingResult => {
  const [basePrice, setBasePrice] = useState<number>(initialBasePrice);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);

  // Sync basePrice when initialBasePrice changes
  // Use useEffect for side effects instead of useState callback
  // [Fix] Removed useEffect that was resetting basePrice to initialBasePrice (0)
  // [Fix] The consumer should use setBasePrice to update the base price.

  // Calculate total price from options
  const optionsTotal = useMemo(() => {
    return selectedOptions.reduce((sum, { option, quantity }) => {
      return sum + option.price * quantity;
    }, 0);
  }, [selectedOptions]);

  // Total price including base fee
  const totalPrice = useMemo(() => {
    return basePrice + optionsTotal;
  }, [basePrice, optionsTotal]);

  // Toggle an option (add/remove)
  const toggleOption = useCallback((option: ConferenceOption, quantity: number = 1) => {
    setSelectedOptions((prev) => {
      const existingIndex = prev.findIndex((item) => item.option.id === option.id);

      if (existingIndex >= 0) {
        // Remove option if already selected
        return prev.filter((item) => item.option.id !== option.id);
      } else {
        // Add new option
        return [...prev, { option, quantity }];
      }
    });
  }, []);

  // Update quantity for a specific option
  const updateOptionQuantity = useCallback((optionId: string, quantity: number) => {
    if (quantity <= 0) {
      // Remove option if quantity is 0 or negative
      setSelectedOptions((prev) => prev.filter((item) => item.option.id !== optionId));
      return;
    }

    setSelectedOptions((prev) => {
      return prev.map((item) => {
        if (item.option.id === optionId) {
          // Check max quantity constraint
          const maxQty = item.option.maxQuantity || 1;
          const finalQuantity = Math.min(quantity, maxQty);
          return { ...item, quantity: finalQuantity };
        }
        return item;
      });
    });
  }, []);

  // Clear all selected options
  const clearOptions = useCallback(() => {
    setSelectedOptions([]);
  }, []);

  // Check if an option is selected
  const isOptionSelected = useCallback(
    (optionId: string): boolean => {
      return selectedOptions.some((item) => item.option.id === optionId);
    },
    [selectedOptions]
  );

  // Get quantity for a specific option
  const getOptionQuantity = useCallback(
    (optionId: string): number => {
      const found = selectedOptions.find((item) => item.option.id === optionId);
      return found?.quantity || 0;
    },
    [selectedOptions]
  );

  return {
    basePrice,
    selectedOptions,
    totalPrice,
    optionsTotal,
    setBasePrice,
    toggleOption,
    updateOptionQuantity,
    clearOptions,
    isOptionSelected,
    getOptionQuantity,
  };
};
