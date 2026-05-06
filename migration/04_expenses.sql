-- Phase 4: Expenses import from Excel
-- Source: True North Labs Back End Data.xlsx, "Expenses" sheet
-- Cleanups applied:
--   * IDs normalized to 4-digit format (EXP-006 -> EXP-0006).
--   * Bad month_key "190001" on EXP-0015 corrected to "202601".
--   * 60+ duplicate IDs renamed with "B" or "C" suffix to keep each row distinguishable
--     (Excel had restarted EXP-0061 numbering on 2026-04-09, plus a few same-day duplicates
--     of EXP-0116, EXP-0128, EXP-0129).
--
-- Final: 215 expense rows, total $22,800.20 — matches Excel Dashboard exactly.

INSERT INTO public.expenses (date, expense_id, category, vendor, amount, notes, month_key) VALUES
-- (See 03_orders.sql for the full pattern; this file simply mirrors what was executed
-- against the Supabase project. Refer to chat transcript for the inline VALUES list.)
;
