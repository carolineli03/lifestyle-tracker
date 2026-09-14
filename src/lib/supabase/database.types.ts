/**
 * Hand-maintained mirror of supabase/migrations.
 *
 * Regenerate from a live database instead of editing by hand once the project
 * is linked:  npm run db:types
 *
 * Every row shape below is a `type`, never an `interface`. That is load-bearing,
 * not style: supabase-js constrains each table to Record<string, unknown>, and
 * TypeScript only grants implicit index signatures to type aliases. Declare one
 * of these as an interface and the whole schema quietly fails the constraint —
 * the client falls back to an untyped schema and `.rpc()` starts reporting its
 * arguments as `undefined`, nowhere near the actual mistake.
 */

export type StorageLocation = "fridge" | "freezer" | "pantry";
export type HouseholdRole = "owner" | "member";
export type SexAtBirth = "female" | "male";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type RecipeSource = "manual" | "idea" | "import";

export type Household = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
};

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  created_at: string;
};

export type Profile = {
  user_id: string;
  sex_at_birth: SexAtBirth | null;
  age: number | null;
  height_inches: number | null;
  activity_factor: number | null;
  target_rate_lb_week: number | null;
  kcal_target: number | null;
  protein_target: number | null;
  carb_target: number | null;
  fat_target: number | null;
  start_weight: number | null;
  start_date: string | null;
  goal_weight: number | null;
  goal_date: string | null;
  weekly_movement_goal: number | null;
  fiber_target: number | null;
  sugar_limit: number | null;
  sodium_limit: number | null;
  water_goal_oz: number;
  eat_back_exercise: boolean;
  created_at: string;
  updated_at: string;
};

export type PantryItem = {
  household_id: string;
  id: string;
  name: string;
  quantity: string | null;
  location: StorageLocation;
  expires_on: string | null;
  created_by: string | null;
  created_at: string;
};

export type Food = {
  household_id: string;
  id: string;
  name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  serving_label: string | null;
  barcode: string | null;
  times_logged: number;
  last_logged_at: string | null;
  created_at: string;
};

export type ShoppingListItem = {
  household_id: string;
  id: string;
  name: string;
  note: string | null;
  done: boolean;
  added_by: string | null;
  created_at: string;
  done_at: string | null;
};

export type Recipe = {
  household_id: string;
  id: string;
  name: string;
  /** What the recipe as written makes. */
  servings: number;
  ingredients: string[];
  method: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  source: RecipeSource;
  created_by: string | null;
  created_at: string;
};

export type MealPlanEntry = {
  household_id: string;
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  planned_on: string;
  meal: MealSlot;
  recipe_id: string;
  eaters: number;
  /** Null when cooked that day; otherwise the cooked row these leftovers come from. */
  leftovers_from: string | null;
  created_by: string | null;
  created_at: string;
};

export type Entry = {
  user_id: string;
  id: string;
  logged_on: string;
  meal: MealSlot | null;
  name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  food_id: string | null;
  created_at: string;
};

export type Movement = {
  user_id: string;
  id: string;
  logged_on: string;
  kind: string;
  minutes: number;
  kcal: number | null;
  created_at: string;
};

export type WaterLog = {
  user_id: string;
  id: string;
  logged_on: string;
  amount_oz: number;
  created_at: string;
};

export type BodyMeasurement = {
  user_id: string;
  id: string;
  measured_on: string;
  kind: string;
  value_in: number;
  created_at: string;
};

export type ProgressPhoto = {
  user_id: string;
  id: string;
  taken_on: string;
  storage_path: string;
  note: string | null;
  created_at: string;
};

export type WeighIn = {
  user_id: string;
  id: string;
  logged_on: string;
  weight_lb: number;
  created_at: string;
};

export type AiUsage = {
  user_id: string;
  id: string;
  route: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  ok: boolean;
  created_at: string;
};

type Row<T> = T;
type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

export type Database = {
  public: {
    Tables: {
      households: {
        Row: Row<Household>;
        Insert: Insert<Household, "id" | "join_code" | "created_at">;
        Update: Partial<Household>;
        Relationships: [];
      };
      household_members: {
        Row: Row<HouseholdMember>;
        Insert: Insert<HouseholdMember, "role" | "created_at">;
        Update: Partial<HouseholdMember>;
        Relationships: [];
      };
      profiles: {
        Row: Row<Profile>;
        Insert: Insert<Profile, Exclude<keyof Profile, "user_id">>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      pantry_items: {
        Row: Row<PantryItem>;
        Insert: Insert<PantryItem, "id" | "created_at" | "created_by" | "quantity" | "expires_on" | "location">;
        Update: Partial<PantryItem>;
        Relationships: [];
      };
      recipes: {
        Row: Row<Recipe>;
        Insert: Insert<
          Recipe,
          "id" | "created_at" | "created_by" | "servings" | "ingredients" | "method" | "kcal" | "protein_g" | "carb_g" | "fat_g" | "source"
        >;
        Update: Partial<Recipe>;
        Relationships: [];
      };
      meal_plan: {
        Row: Row<MealPlanEntry>;
        Insert: Insert<MealPlanEntry, "id" | "created_at" | "created_by" | "eaters" | "leftovers_from">;
        Update: Partial<MealPlanEntry>;
        Relationships: [];
      };
      shopping_list: {
        Row: Row<ShoppingListItem>;
        Insert: Insert<ShoppingListItem, "id" | "created_at" | "note" | "done" | "added_by" | "done_at">;
        Update: Partial<ShoppingListItem>;
        Relationships: [];
      };
      foods: {
        Row: Row<Food>;
        Insert: Insert<
          Food,
          "id" | "created_at" | "times_logged" | "last_logged_at" | "kcal" | "protein_g" | "carb_g" | "fat_g" | "fiber_g" | "sugar_g" | "sodium_mg" | "serving_label" | "barcode"
        >;
        Update: Partial<Food>;
        Relationships: [];
      };
      entries: {
        Row: Row<Entry>;
        Insert: Insert<Entry, "id" | "created_at" | "food_id" | "logged_on" | "meal" | "fiber_g" | "sugar_g" | "sodium_mg">;
        Update: Partial<Entry>;
        Relationships: [];
      };
      movement: {
        Row: Row<Movement>;
        Insert: Insert<Movement, "id" | "created_at" | "logged_on" | "kcal">;
        Update: Partial<Movement>;
        Relationships: [];
      };
      water_logs: {
        Row: Row<WaterLog>;
        Insert: Insert<WaterLog, "id" | "created_at" | "logged_on">;
        Update: Partial<WaterLog>;
        Relationships: [];
      };
      body_measurements: {
        Row: Row<BodyMeasurement>;
        Insert: Insert<BodyMeasurement, "id" | "created_at" | "measured_on">;
        Update: Partial<BodyMeasurement>;
        Relationships: [];
      };
      progress_photos: {
        Row: Row<ProgressPhoto>;
        Insert: Insert<ProgressPhoto, "id" | "created_at" | "taken_on" | "note">;
        Update: Partial<ProgressPhoto>;
        Relationships: [];
      };
      weigh_ins: {
        Row: Row<WeighIn>;
        Insert: Insert<WeighIn, "id" | "created_at" | "logged_on">;
        Update: Partial<WeighIn>;
        Relationships: [];
      };
      ai_usage: {
        Row: Row<AiUsage>;
        Insert: Insert<AiUsage, "id" | "created_at" | "input_tokens" | "output_tokens" | "ok">;
        Update: Partial<AiUsage>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_household: { Args: { p_name: string }; Returns: Household };
      log_entry: {
        Args: {
          p_name: string;
          p_kcal: number;
          p_protein_g: number;
          p_carb_g: number;
          p_fat_g: number;
          p_logged_on?: string;
          p_remember?: boolean;
          p_serving_kcal?: number;
          p_serving_protein_g?: number;
          p_serving_carb_g?: number;
          p_serving_fat_g?: number;
          p_meal?: MealSlot;
          p_fiber_g?: number;
          p_sugar_g?: number;
          p_sodium_mg?: number;
          p_serving_fiber_g?: number;
          p_serving_sugar_g?: number;
          p_serving_sodium_mg?: number;
          p_serving_label?: string;
          p_barcode?: string;
        };
        Returns: Entry;
      };
      join_household: { Args: { p_code: string }; Returns: Household };
      stock_shopping_item: {
        Args: {
          p_id: string;
          p_quantity?: string | null;
          p_location?: StorageLocation;
          p_expires_on?: string | null;
        };
        Returns: PantryItem;
      };
      current_household_id: { Args: Record<string, never>; Returns: string | null };
      is_household_member: { Args: { p_household_id: string }; Returns: boolean };
      ai_calls_since: { Args: { p_since: string }; Returns: number };
    };
    Enums: {
      storage_location: StorageLocation;
      household_role: HouseholdRole;
      sex_at_birth: SexAtBirth;
      meal_slot: MealSlot;
    };
    CompositeTypes: Record<never, never>;
  };
};
