import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout } from '../Layout/Layout';
import { AdminRoute } from '../AdminRoute';
import { AdminCustomerBrandSelector } from './AdminCustomerBrandSelector';
import { useAdminStore } from '../../store/adminStore';
import { cacheManager } from '../../lib/cacheManager';

export const AdminLayout = () => {
    const { selectedCustomerId, selectedBrandId, setSelectedCustomerId, setSelectedBrandId } = useAdminStore();
    const navigate = useNavigate();

    const handleCustomerChange = (id: string | null) => {
        setSelectedCustomerId(id);
        if (id) {
            localStorage.setItem('admin-impersonation:customer-id', id);
        } else {
            localStorage.removeItem('admin-impersonation:customer-id');
            localStorage.removeItem('manual-dashboard:selected-brand');
        }
        cacheManager.clear();
        // Dispatch custom event for real-time sync
        window.dispatchEvent(new CustomEvent('admin-impersonation-change'));
    };

    const handleBrandChange = (id: string | null) => {
        setSelectedBrandId(id);
        if (id) {
            localStorage.setItem('manual-dashboard:selected-brand', id);
        } else {
            localStorage.removeItem('manual-dashboard:selected-brand');
        }
        cacheManager.clear();
        // Dispatch custom event for real-time sync across all components
        window.dispatchEvent(new CustomEvent('admin-impersonation-change'));
    };

    return (
        <AdminRoute>
            <Layout>
                <div className="p-6">
                    <AdminCustomerBrandSelector
                        selectedCustomerId={selectedCustomerId}
                        selectedBrandId={selectedBrandId}
                        onCustomerChange={handleCustomerChange}
                        onBrandChange={handleBrandChange}
                    />
                    <Outlet />
                </div>
            </Layout>
        </AdminRoute>
    );
};
