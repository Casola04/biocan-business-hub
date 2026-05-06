-- Phase 2: Products import from Excel
-- Source: True North Labs Back End Data.xlsx, "Stock" sheet
-- All stock_qty set to 0 per user direction (will be re-input manually).
-- unit_cost left untouched on existing rows; defaults to 0 on new rows.
-- Names aligned with Excel exactly so order import name-matching works.

UPDATE public.products SET name='BPC-157',         unit_price=100, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-001';
UPDATE public.products SET name='BPC-157/TB-500',  unit_price=175, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-002';
UPDATE public.products SET name='Retatrutide',     unit_price=175, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-003';
UPDATE public.products SET name='NAD+',            unit_price=100, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-004';
UPDATE public.products SET name='Ipamorelin',      unit_price=135, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-005';
UPDATE public.products SET name='GHK-CU',          unit_price=115, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-006';
UPDATE public.products SET name='Tesamorelin',     unit_price=175, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-007';
UPDATE public.products SET name='Glutithione',     unit_price=100, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-008';
UPDATE public.products SET name='Semax',           unit_price=85,  stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-009';
UPDATE public.products SET name='Melanotan 2',     unit_price=80,  stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-010';
UPDATE public.products SET name='Mots - C',        unit_price=190, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-011';
UPDATE public.products SET name='SLUPP-332',       unit_price=115, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-012';
UPDATE public.products SET name='CJC - DAC',       unit_price=120, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-013';
UPDATE public.products SET name='Sermorelin',      unit_price=120, stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-014';
UPDATE public.products SET name='KPV',             unit_price=85,  stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-015';
UPDATE public.products SET name='Epitalon',        unit_price=80,  stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-016';
UPDATE public.products SET name='BAC Water',       unit_price=25,  stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-017';
UPDATE public.products SET name='Kisspeptin',      unit_price=95,  stock_qty=0, reorder_level=5,  supplier='BioCan Pharma' WHERE sku='EPA-018';

INSERT INTO public.products (product_id, name, sku, unit_price, stock_qty, reorder_level, supplier, unit_cost) VALUES
  ('PRD-0017','BAC Water',   'EPA-017', 25,  0, 5,  'BioCan Pharma', 0),
  ('PRD-0019','TB-500',      'EPA-019', 100, 0, 5,  'BioCan Pharma', 0),
  ('PRD-0020','PT-141',      'EPA-020', 100, 0, 5,  'BioCan Pharma', 0),
  ('PRD-0021','BAC - Water', 'EPA-021', 20,  0, 25, 'Pfizer Canada', 0),
  ('PRD-0022','Cerebrolysin','EPA-022', 50,  0, 10, 'Yura Peptides', 0),
  ('PRD-0023','IGF1-LR3',    'EPA-023', 140, 0, 10, 'Yura Peptides', 0);

-- Note: EPA-017 (BAC Water) had been previously deleted from the live products table
-- before this migration ran, so it's re-inserted here rather than UPDATEd above.
