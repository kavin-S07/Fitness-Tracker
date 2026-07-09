// ============================================================
// src/components/FoodAutocompleteInput.tsx
//
// Drop-in replacement for a plain food-name <input>. Shows a
// debounced suggestion dropdown backed by food_nutrition_reference
// as the user types, and autofills calories/protein/carbs/fats
// (scaled by a servings multiplier) when a suggestion is picked.
//
// The autofilled values are only a starting point — the parent
// form's fields stay manually editable afterward, and typing again
// in this input clears the lock so manual entry is never blocked.
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

const scale = (base: number, multiplier: number) =>
  Math.round(base * multiplier);

const FoodAutocompleteInput: React.FC<FoodAutocompleteInputProps> = ({
  value,
  onNameChange,
  onAutofill,
}) => {
  const [suggestions, setSuggestions] = useState<FoodReferenceResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<FoodReferenceResult | null>(null);
  const [servings, setServings] = useState(1);
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

  const applyAutofill = (food: FoodReferenceResult, multiplier: number) => {
    onAutofill({
      calories: scale(food.calories_kcal, multiplier),
      protein:  scale(food.protein_g, multiplier),
      carbs:    scale(food.carbohydrates_g, multiplier),
      fats:     scale(food.fat_g, multiplier),
    });
  };

  const handleSelect = (food: FoodReferenceResult) => {
    setSelected(food);
    setServings(1);
    onNameChange(food.food_name);
    setShowDropdown(false);
    applyAutofill(food, 1);
  };

  const handleServingsChange = (raw: string) => {
    const next = parseFloat(raw);
    setServings(Number.isNaN(next) ? 0 : next);
    if (selected && !Number.isNaN(next) && next > 0) {
      applyAutofill(selected, next);
    }
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
          // Typing again after a selection means the user is correcting
          // the name — drop the lock and fall back to manual entry.
          if (selected) setSelected(null);
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

      {selected && (
        <div className="food-autocomplete-servings">
          <label>
            Servings ({selected.serving_quantity} each)
            <input
              className="input-field"
              type="number"
              min={0.25}
              step="any"
              value={servings}
              onChange={e => handleServingsChange(e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default FoodAutocompleteInput;
