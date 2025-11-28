import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { useNavigate } from 'react-router-dom';
import { IconForms, IconChevronRight } from '@tabler/icons-react';

export const Settings = () => {
  const navigate = useNavigate();

  const settingsOptions = [
    {
      id: 'manage-prompts',
      title: 'Prompts & Topics',
      description: 'Edit tracked topics and the prompts that power your analyses from one place',
      icon: IconForms,
      path: '/settings/manage-prompts',
    },
  ];

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
            Settings
          </h1>
          <p className="text-[var(--text-caption)]">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-4">
          {settingsOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => navigate(option.path)}
                className="w-full bg-white border border-[var(--border-default)] rounded-lg p-6 hover:border-[var(--accent-primary)] hover:shadow-sm transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center group-hover:bg-[var(--accent-primary)]/20 transition-colors">
                    <Icon size={24} className="text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-1">
                      {option.title}
                    </h3>
                    <p className="text-sm text-[var(--text-caption)]">
                      {option.description}
                    </p>
                  </div>
                </div>
                <IconChevronRight 
                  size={20} 
                  className="text-[var(--text-caption)] group-hover:text-[var(--accent-primary)] transition-colors" 
                />
              </button>
            );
          })}
        </div>
        </div>
      </SettingsLayout>
    </Layout>
  );
};

