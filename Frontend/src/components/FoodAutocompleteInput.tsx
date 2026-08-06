// ============================================================
// src/components/FoodAutocompleteInput.tsx
//
// Drop-in replacement for a plain food-name <input>. Shows a
// debounced suggestion dropdown backed by food_nutrition_reference
// as the user types, and autofills calories/protein/carbs/fats
// when a suggestion is picked.
//
// The autofilled values are only a starting point — the parent
// form's fields stay manually editable afterward.
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import { foodAPI } from '../services/api';
import { FoodReferenceResult } from '../types';

interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface FoodAutocompleteInputProps {
  value: string;
  onNameChange: (name: string) => void;
  onAutofill: (values: NutritionValues) => void;
}

// Used internally when a suggested food is picked with a serving multiplier.
// Scales a base nutrition value (e.g. calories) by the given multiplier and rounds it.
const scale = (base: number, multiplier: number) =>
  Math.round(base * multiplier);

// Used on the "add food" form wherever a user types in a food name.
// Shows live food suggestions as the user types and autofills nutrition values when one is picked.
const FoodAutocompleteInput: React.FC<FoodAutocompleteInputProps> = ({
  value,
  onNameChange,
  onAutofill,
}) => {
  const [suggestions, setSuggestions] = useState<FoodReferenceResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await foodAPI.searchReference(value);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch (err) {
        // Search failing shouldn't block manual entry — just show nothing.
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Used when a user selects a food suggestion from the dropdown.
  // Fills the parent form's calorie/protein/carb/fat fields from the selected food.
  const applyAutofill = (food: FoodReferenceResult, multiplier: number) => {
    onAutofill({
      calories: scale(food.calories_kcal, multiplier),
      protein:  scale(food.protein_g, multiplier),
      carbs:    scale(food.carbohydrates_g, multiplier),
      fats:     scale(food.fat_g, multiplier),
    });
  };

  // Used when a user clicks a suggestion in the autocomplete dropdown.
  // Sets the food name and triggers the nutrition autofill.
  const handleSelect = (food: FoodReferenceResult) => {
    onNameChange(food.food_name);
    setShowDropdown(false);
    applyAutofill(food, 1);
  };

  return (
    <div className="food-autocomplete-wrapper">
      <input
        className="input-field"
        type="text"
        placeholder="e.g. Idli, Dosa, Boiled Eggs"
        value={value}
        autoComplete="off"
        onChange={e => {
          onNameChange(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      />

      {showDropdown && (
        <ul className="food-autocomplete-dropdown">
          {suggestions.map(food => (
            <li key={food.id} onMouseDown={() => handleSelect(food)}>
              <div className="food-autocomplete-name">{food.food_name}</div>
              <div className="food-autocomplete-meta">
                <span>{food.serving_quantity}</span>
                <span>{food.calories_kcal} kcal · {food.protein_g}g protein</span>
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
};

export default FoodAutocompleteInput;
