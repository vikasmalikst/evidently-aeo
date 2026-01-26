/*
  # Add customer_id cascade trigger for brands table
  
  When a brand's customer_id is updated, cascade the change to metric_facts.
  This ensures dashboard queries continue to work correctly after brand transfers.
  
  ## Why this is needed:
  - metric_facts stores customer_id for performance/filtering
  - If a brand is transferred to a different customer, old data still has old customer_id
  - Dashboard queries filter by customer_id, missing historical data
  
  ## What this does:
  - Creates a trigger function that updates metric_facts.customer_id when brands.customer_id changes
  - Logs the cascade action for audit purposes
*/

-- Create trigger function
CREATE OR REPLACE FUNCTION public.update_metric_facts_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only cascade if customer_id actually changed
  IF OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    UPDATE public.metric_facts 
    SET customer_id = NEW.customer_id 
    WHERE brand_id = NEW.id;
    
    RAISE NOTICE 'Cascaded customer_id change for brand %: % -> %', 
      NEW.id, OLD.customer_id, NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on brands table
DROP TRIGGER IF EXISTS brands_customer_id_cascade ON public.brands;

CREATE TRIGGER brands_customer_id_cascade
AFTER UPDATE OF customer_id ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_metric_facts_customer_id();

-- Add comment for documentation
COMMENT ON FUNCTION public.update_metric_facts_customer_id() IS 
  'Cascades customer_id changes from brands to metric_facts. Ensures dashboard queries work after brand transfers.';

COMMENT ON TRIGGER brands_customer_id_cascade ON public.brands IS
  'Automatically updates metric_facts.customer_id when a brand is transferred to a different customer.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20260126000000_add_customer_id_cascade_trigger.sql completed successfully';
  RAISE NOTICE '📊 Created trigger: brands_customer_id_cascade';
  RAISE NOTICE '📊 Created function: update_metric_facts_customer_id()';
END $$;
