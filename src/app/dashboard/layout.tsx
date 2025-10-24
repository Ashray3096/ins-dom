'use client';

/**
 * Dashboard Layout
 *
 * Main layout with sidebar navigation, header, and breadcrumbs
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Database,
  FileText,
  Layout,
  Wand2,
  Activity,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Home,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Providers', href: '/dashboard/providers', icon: Database },
  { name: 'Sources', href: '/dashboard/sources', icon: Settings },
  { name: 'Artifacts', href: '/dashboard/artifacts', icon: FileText },
  { name: 'Templates', href: '/dashboard/templates', icon: Layout },
  { name: 'Entities', href: '/dashboard/entities', icon: Wand2 },
  { name: 'Pipelines', href: '/dashboard/pipelines', icon: Activity },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    // TODO: Implement logout logic
    router.push('/auth/login');
  };

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', href: '/dashboard' }];

    let currentPath = '';
    paths.forEach((path, index) => {
      if (path === 'dashboard') return;
      currentPath += `/${path}`;
      breadcrumbs.push({
        name: path.charAt(0).toUpperCase() + path.slice(1),
        href: `/dashboard${currentPath}`,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                Inspector Dom
              </span>
            </Link>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 mr-3',
                      isActive ? 'text-blue-700' : 'text-gray-500'
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    U
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    User
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    user@example.com
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="ml-2"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                className="lg:hidden mr-4"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6 text-gray-500" />
              </button>

              {/* Breadcrumbs */}
              <nav className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((breadcrumb, index) => (
                  <div key={breadcrumb.href} className="flex items-center">
                    {index > 0 && (
                      <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
                    )}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="font-medium text-gray-900">
                        {breadcrumb.name}
                      </span>
                    ) : (
                      <Link
                        href={breadcrumb.href}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {breadcrumb.name}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
