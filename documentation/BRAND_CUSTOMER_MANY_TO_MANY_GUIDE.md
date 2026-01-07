# Brand-Customer Many-to-Many Relationship Guide

## Current State

**Current Relationship**: One-to-Many
- One customer → Many brands ✅
- One brand → One customer ❌

**Schema**:
```sql
brands (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,  -- Single customer only
  name TEXT,
  ...
)
```

## Proposed State

**Proposed Relationship**: Many-to-Many
- One customer → Many brands ✅
- One brand → Many customers ✅

**Schema**:
```sql
brands (
  id UUID PRIMARY KEY,
  customer_id UUID,  -- Optional: keep for primary owner (backward compat)
  name TEXT,
  ...
)

brand_customers (  -- NEW junction table
  brand_id UUID REFERENCES brands(id),
  customer_id UUID REFERENCES customers(id),
  is_primary_owner BOOLEAN,
  access_level TEXT,
  UNIQUE(brand_id, customer_id)
)
```

## Implementation Impact

### 1. Database Changes Required

✅ **Created**: `migrations/create-brand-customer-many-to-many.sql`
- Creates `brand_customers` junction table
- Migrates existing data
- Adds helper functions
- Creates backward-compatible view

### 2. Application Code Changes Required

#### Backend Services

**`backend/src/services/brand.service.ts`**

**Current**:
```typescript
async getBrandsByCustomer(customerId: string): Promise<Brand[]> {
  const { data: brands } = await supabaseAdmin
    .from('brands')
    .select('*')
    .eq('customer_id', customerId);  // ❌ Only gets brands where customer_id matches
  return brands;
}
```

**Updated**:
```typescript
async getBrandsByCustomer(customerId: string): Promise<Brand[]> {
  // Option 1: Use junction table
  const { data: brandCustomers } = await supabaseAdmin
    .from('brand_customers')
    .select('brand_id')
    .eq('customer_id', customerId);
  
  const brandIds = brandCustomers?.map(bc => bc.brand_id) || [];
  
  const { data: brands } = await supabaseAdmin
    .from('brands')
    .select('*')
    .in('id', brandIds);
  
  return brands;
  
  // Option 2: Use helper function
  // const { data } = await supabaseAdmin.rpc('get_customer_brands', {
  //   p_customer_id: customerId
  // });
}
```

**Current**:
```typescript
async getBrandById(brandId: string, customerId: string): Promise<Brand | null> {
  const { data: brand } = await supabaseAdmin
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .eq('customer_id', customerId)  // ❌ Requires exact match
    .single();
  return brand;
}
```

**Updated**:
```typescript
async getBrandById(brandId: string, customerId: string): Promise<Brand | null> {
  // First check if customer has access
  const { data: hasAccess } = await supabaseAdmin
    .rpc('customer_has_brand_access', {
      p_customer_id: customerId,
      p_brand_id: brandId
    });
  
  if (!hasAccess) {
    return null;
  }
  
  const { data: brand } = await supabaseAdmin
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single();
  
  return brand;
}
```

#### Routes

**`backend/src/routes/brand.routes.ts`**

All routes that filter by `customer_id` need updates:
- `GET /brands` - Use junction table
- `GET /brands/:id` - Check access via junction table
- `POST /brands` - Create entry in junction table
- `DELETE /brands/:id` - Check if primary owner before delete

#### Frontend

**`src/api/brandApi.ts`**

May need updates if it assumes one customer per brand.

### 3. Data Access Patterns

#### Current Pattern
```typescript
// Get all brands for customer
const brands = await brandService.getBrandsByCustomer(customerId);

// Get specific brand (must match customer)
const brand = await brandService.getBrandById(brandId, customerId);
```

#### New Pattern
```typescript
// Get all brands for customer (includes shared brands)
const brands = await brandService.getBrandsByCustomer(customerId);

// Get specific brand (checks access, not ownership)
const brand = await brandService.getBrandById(brandId, customerId);

// Get all customers for a brand
const customers = await brandService.getCustomersByBrand(brandId);

// Share brand with another customer
await brandService.addCustomerToBrand(brandId, newCustomerId, 'read_only');
```

### 4. Security Considerations

**Row Level Security (RLS)**
- Update policies to check `brand_customers` table
- Ensure customers can only see brands they have access to
- Restrict modifications to primary owners

**Access Control**
- Primary owner: Full control (delete, modify, share)
- Full access: Can view and use brand data
- Read-only: Can view but not modify
- Limited: Custom restrictions

### 5. Migration Strategy

#### Phase 1: Add Junction Table (Non-Breaking)
1. Run `create-brand-customer-many-to-many.sql`
2. Keep `customer_id` on `brands` table
3. Populate junction table from existing data
4. **No application changes yet** - backward compatible

#### Phase 2: Update Application Code
1. Update `brand.service.ts` methods
2. Update routes to use junction table
3. Add new methods: `addCustomerToBrand()`, `removeCustomerFromBrand()`
4. Test thoroughly

#### Phase 3: Remove Legacy Column (Breaking)
1. Once all code uses junction table
2. Remove `customer_id` from `brands` table
3. Update all queries

### 6. Testing Checklist

- [ ] Existing brands still accessible to their customers
- [ ] Can share brand with new customer
- [ ] Can remove customer from brand (non-primary)
- [ ] Primary owner restrictions work
- [ ] Access levels enforced correctly
- [ ] Dashboard queries work with shared brands
- [ ] Data collection works for shared brands
- [ ] RLS policies prevent unauthorized access

### 7. Example Use Cases

#### Use Case 1: Agency Managing Multiple Clients
```
Agency (customer_id: A) creates Brand X
Agency shares Brand X with Client (customer_id: B)
Both Agency and Client can see Brand X data
Agency (primary owner) can delete/modify
Client (shared) can view and use
```

#### Use Case 2: Brand Transfer
```
Company A (customer_id: A) owns Brand X
Company A transfers ownership to Company B (customer_id: B)
Update: Set Company B as primary owner
Company A can remain as shared access or be removed
```

#### Use Case 3: Multi-Tenant Brand
```
Brand X is owned by Customer A
Customer A shares with Customer B (read-only)
Customer A shares with Customer C (full access)
All three can see Brand X, but only A can delete
```

## Recommendation

**For Existing System**: Use **Hybrid Approach**
- Keep `customer_id` on `brands` as "primary owner" for backward compatibility
- Add `brand_customers` junction table for additional access
- Gradual migration path
- Less risky

**For New System**: Use **Pure Junction Table**
- Remove `customer_id` from `brands`
- Use only `brand_customers`
- Cleaner design
- Requires full rewrite

## Questions to Consider

1. **Do you need this feature?** 
   - If only one customer per brand, current design is fine

2. **What's the use case?**
   - Agency managing clients?
   - Brand transfers?
   - Multi-tenant scenarios?

3. **Access control needs?**
   - Just shared access?
   - Different permission levels?
   - Audit trail?

4. **Migration timeline?**
   - Can you afford downtime?
   - Need backward compatibility?

## Next Steps

1. Review this guide
2. Decide on approach (Hybrid vs Pure)
3. Test migration script on staging
4. Update application code
5. Deploy to production
6. Monitor for issues

