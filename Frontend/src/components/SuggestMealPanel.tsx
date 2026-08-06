// ============================================================
// src/components/SuggestMealPanel.tsx
//
// "Suggest a meal" panel for the Food Tracker page. Lets the user pick a
// meal type, see a combo suggestion that fits their remaining calories/
// protein for that meal, cycle to another suggestion, grab a fully random
// one, or log every item in the combo in one batch.
// ============================================================
import React, { useEffect, useState } from 'react';
import { foodAPI } from '../services/api';
import { MealCombination, MealComboItem, MealType } from '../types';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const MEAL_TYPES: { value: MealType; label: string; icon: string; category: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: '🍳', category: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch',     icon: '🥗', category: 'Lunch' },
  { value: 'dinner',    label: 'Dinner',    icon: '🍽️', category: 'Dinner' },
  { value: 'snack',     label: 'Snack',     icon: '🥜', category: 'Snacks' },
];

// How much of the day's remaining calories/protein to aim for when
// suggesting a combo for a given meal — a simple apportionment since the
// dashboard only exposes a single whole-day "remaining" figure. Roughly
// mirrors typical meal-size proportions across a day.
const MEAL_SHARE: Record<MealType, number> = {
  breakfast: 0.28,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.12,
};

// ------------------------------------------------------------------
// Shared styles (mirrors FoodPage.tsx's card/input conventions)
// ------------------------------------------------------------------
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(0,0,0,0.09)',
  borderRadius: '14px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
};

// Used internally when displaying nutrition numbers in this panel.
// Rounds a number to one decimal place for cleaner display.
function round(n: number) {
  return Math.round(n * 10) / 10;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
interface Props {
  // Called after a successful batch log, so the parent can refresh
  // history / today's totals.
  onLogged?: () => void;
}

// Used on the Food page as the "Suggest a meal" section.
// Lets the user pick a meal type and see/log a pre-built meal combo that fits their remaining targets.
const SuggestMealPanel: React.FC<Props> = ({ onLogged }) => {
  const [mealType, setMealType] = useState<MealType>('breakfast');

  const [remainingCalories, setRemainingCalories] = useState(0);
  const [remainingProtein, setRemainingProtein] = useState(0);
  const [targetsLoading, setTargetsLoading] = useState(true);

  const [combo, setCombo] = useState<MealCombination | null>(null);
  const [items, setItems] = useState<MealComboItem[]>([]);
  const [shownIds, setShownIds] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [isRandom, setIsRandom] = useState(false);

  const [logLoading, setLogLoading] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // On mount and whenever the meal type changes: load today's remaining
  // calories/protein (apportioned for this meal), then fetch a matching
  // suggestion. Runs as one effect so there's no cross-effect dependency
  // chain to track.
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    // Used automatically when the panel first loads or the user changes the meal type.
    // Loads the user's remaining calories/protein for this meal, then fetches a matching combo suggestion.
    const run = async () => {
      setTargetsLoading(true);
      setLoading(true);
      setError(null);
      setEmpty(false);
      setLogMessage(null);
      setIsRandom(false);

      let calories = mealType === 'snack' ? 200 : 500;
      let protein = mealType === 'snack' ? 15 : 25;
      try {
        const res = await foodAPI.getToday();
        const summary = res.data?.summary || {};
        const dayRemainingCal = Math.max(0, summary.remaining_calories ?? 0);
        const dayRemainingPro = Math.max(0, summary.remaining_protein ?? 0);
        calories = Math.round(dayRemainingCal * MEAL_SHARE[mealType]);
        protein = Math.round(dayRemainingPro * MEAL_SHARE[mealType]);
      } catch {
        // Keep the sane fallback defaults set above — the suggestion API
        // still works, it'll just aim at generic targets.
      }
      if (cancelled) return;
      setRemainingCalories(calories);
      setRemainingProtein(protein);
      setTargetsLoading(false);

      try {
        const res = await foodAPI.suggestMeal({
          mealType,
          targetCalories: calories,
          targetProtein: protein,
        });
        if (cancelled) return;
        const data = res.data;
        if (!data.combination) {
          setCombo(null);
          setItems([]);
          setShownIds([]);
          setEmpty(true);
        } else {
          setCombo(data.combination);
          setItems(data.items);
          setShownIds([data.combination.id]);
          setExpanded(false);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to load a suggestion.');
        setCombo(null);
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [mealType]);

  // ------------------------------------------------------------------
  // "Next combination" — same targets, excludes everything shown so far.
  // ------------------------------------------------------------------
  // Used when the user clicks "Next combination".
  // Fetches another combo suggestion, skipping ones already shown this session.
  const handleNext = async () => {
    setLoading(true);
    setError(null);
    setEmpty(false);
    setLogMessage(null);
    setIsRandom(false);
    try {
      const res = await foodAPI.suggestMeal({
        mealType,
        targetCalories: remainingCalories,
        targetProtein: remainingProtein,
        exclude: shownIds,
      });
      const data = res.data;
      if (!data.combination) {
        setEmpty(true);
        setCombo(null);
        setItems([]);
      } else {
        setCombo(data.combination);
        setItems(data.items);
        setShownIds((prev) => [...prev, data.combination!.id]);
        setExpanded(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load the next combination.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // "Show random combination" — surprise me, ignores targets & exclude list.
  // ------------------------------------------------------------------
  // Used when the user clicks "Show random combination" (Surprise me).
  // Fetches a fully random meal combo for the selected meal type, ignoring calorie/protein targets.
  const handleRandom = async () => {
    setLoading(true);
    setError(null);
    setEmpty(false);
    setLogMessage(null);
    try {
      const res = await foodAPI.randomMeal(mealType);
      const data = res.data;
      if (!data.combination) {
        setCombo(null);
        setItems([]);
        setEmpty(true);
      } else {
        setCombo(data.combination);
        setItems(data.items);
        setIsRandom(true);
        setExpanded(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load a random combination.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // "Log this combo" — one POST /api/food/add per item, in one batch.
  // ------------------------------------------------------------------
  // Used when the user clicks "Log this combo".
  // Saves every food item in the suggested combo as separate food entries in one batch.
  const handleLogCombo = async () => {
    if (!combo || items.length === 0) return;
    setLogLoading(true);
    setLogMessage(null);
    try {
      const category = MEAL_TYPES.find((m) => m.value === mealType)?.category || 'Breakfast';
      await Promise.all(
        items.map((item) =>
          foodAPI.addFood({
            food_name: item.food_name,
            calories: round(item.calories_kcal * item.quantity_multiplier),
            protein: round(item.protein_g * item.quantity_multiplier),
            carbs: round(item.carbohydrates_g * item.quantity_multiplier),
            fats: round(item.fat_g * item.quantity_multiplier),
            category,
          })
        )
      );
      setLogMessage(`Logged all ${items.length} item(s) from "${combo.combo_name}".`);
      onLogged?.();
    } catch (err: any) {
      setLogMessage(err?.response?.data?.message || err?.message || 'Failed to log combo — please try again.');
    } finally {
      setLogLoading(false);
    }
  };

  // ------------------------------------------------------------------
  const activeMeal = MEAL_TYPES.find((m) => m.value === mealType)!;

  return (
    <div className="fade-in" style={{ ...card, padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '0.04em', color: '#0f172a' }}>
            🍽️ Suggest a Meal
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.15rem' }}>
            Combo picks that fit what you have left for {activeMeal.label.toLowerCase()}.
          </p>
        </div>

        {/* Meal type selector */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {MEAL_TYPES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMealType(m.value)}
              className={mealType === m.value ? 'tag active' : 'tag'}
              style={{ cursor: 'pointer' }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {!targetsLoading && (
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
          Aiming for ~{remainingCalories} kcal · {remainingProtein}g protein this {activeMeal.label.toLowerCase()}.
        </div>
      )}

      {(loading || targetsLoading) && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Finding a combo…</div>
      )}

      {error && !loading && (
        <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      {!loading && !error && empty && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: 'rgba(0,0,0,0.03)', borderRadius: '10px' }}>
          No combos match right now — try "Show random combination" instead.
        </div>
      )}

      {!loading && !error && combo && (
        <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '1.25rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.3rem' }}>
                {combo.combo_name}
              </div>
              {isRandom && (
                <span className="badge badge-orange">Surprise pick — may not match your targets</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.75rem', margin: '0.9rem 0' }}>
            {[
              { label: 'Calories', value: `${Math.round(combo.total_calories)} kcal`, color: '#ea6c00' },
              { label: 'Protein',  value: `${round(combo.total_protein)} g`,          color: '#1d4ed8' },
              { label: 'Carbs',    value: `${round(combo.total_carbs)} g`,            color: '#16a34a' },
              { label: 'Fat',      value: `${round(combo.total_fat)} g`,              color: '#dc2626' },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontWeight: 800, color: s.color, fontSize: '0.95rem' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ background: 'transparent', border: 'none', color: '#1d4ed8', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginBottom: expanded ? '0.6rem' : 0 }}
          >
            {expanded ? '▾ Hide items' : '▸ Show items'} ({items.length})
          </button>

          {expanded && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {items.map((item) => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#334155', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px' }}>
                  <span>×{round(item.quantity_multiplier)} {item.food_name}</span>
                  <span style={{ color: '#94a3b8' }}>{Math.round(item.calories_kcal * item.quantity_multiplier)} kcal · {round(item.protein_g * item.quantity_multiplier)}g protein</span>
                </li>
              ))}
            </ul>
          )}

          {logMessage && (
            <div style={{ marginTop: '0.9rem', fontSize: '0.85rem', color: logMessage.startsWith('Logged') ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              {logMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={handleLogCombo} disabled={logLoading} style={{ flex: '1 1 160px' }}>
              {logLoading ? 'Logging…' : 'Log this combo'}
            </button>
            <button className="btn-secondary" onClick={handleNext} disabled={loading} style={{ flex: '1 1 160px' }}>
              Next combination
            </button>
            <button className="btn-secondary" onClick={handleRandom} disabled={loading} style={{ flex: '1 1 160px' }}>
              🎲 Show random combination
            </button>
          </div>
        </div>
      )}

      {!loading && !error && empty && (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
          <button className="btn-secondary" onClick={handleRandom} style={{ flex: 1 }}>
            🎲 Show random combination
          </button>
        </div>
      )}
    </div>
  );
};

export default SuggestMealPanel;
