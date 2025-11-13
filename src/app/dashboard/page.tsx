'use client';

/**
 * Dashboard Home Page
 *
 * Overview of the Inspector Dom platform with quick stats and actions
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, FileText, Layout, Wand2, Activity, ArrowRight, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    providers: 0,
    sources: 0,
    templates: 0,
    entities: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const supabase = createClient();

      const [providersRes, sourcesRes, templatesRes, entitiesRes] = await Promise.all([
        supabase.from('providers').select('*', { count: 'exact', head: true }),
        supabase.from('sources').select('*', { count: 'exact', head: true }),
        supabase.from('templates').select('*', { count: 'exact', head: true }),
        supabase.from('entities').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        providers: providersRes.count || 0,
        sources: sourcesRes.count || 0,
        templates: templatesRes.count || 0,
        entities: entitiesRes.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Inspector Dom</h1>
        <p className="mt-2 text-gray-600">
          AI-powered data extraction platform for transforming documents into structured data
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Providers
            </CardTitle>
            <Database className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.providers}</div>
            <p className="text-xs text-gray-500 mt-1">Data sources configured</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Sources
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.sources}</div>
            <p className="text-xs text-gray-500 mt-1">S3 buckets & uploads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Templates
            </CardTitle>
            <Layout className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.templates}</div>
            <p className="text-xs text-gray-500 mt-1">Extraction templates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Entities
            </CardTitle>
            <Wand2 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.entities}</div>
            <p className="text-xs text-gray-500 mt-1">Data tables created</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with these common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/providers">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <div className="flex items-center w-full">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-4">
                    <Plus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold">Create Provider</div>
                    <div className="text-sm text-gray-500">Add a new data source</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Button>
            </Link>

            <Link href="/dashboard/sources">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <div className="flex items-center w-full">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mr-4">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold">Upload Files</div>
                    <div className="text-sm text-gray-500">Add source documents</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Button>
            </Link>

            <Link href="/dashboard/templates">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <div className="flex items-center w-full">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mr-4">
                    <Layout className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold">Create Template</div>
                    <div className="text-sm text-gray-500">Define extraction fields</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Button>
            </Link>

            <Link href="/dashboard/pipelines">
              <Button variant="outline" className="w-full justify-start h-auto py-4">
                <div className="flex items-center w-full">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mr-4">
                    <Activity className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold">Setup Pipeline</div>
                    <div className="text-sm text-gray-500">Automate extractions</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Follow these steps to start extracting data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Create a Provider</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Set up a provider like NABCA or TTB to organize your data sources
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Upload Source Files</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Upload PDFs, HTML, or other documents you want to extract data from
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Create a Template</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Define the fields you want to extract with AI-powered prompts
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Run Extraction</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Apply your template to source files and let Claude extract the data
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                5
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Review & Correct</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Review extracted data, make corrections, and improve your templates over time
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
