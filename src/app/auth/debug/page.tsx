'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthDebugPage() {
  const [email, setEmail] = useState('ashrayk@twenty20sys.com');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<any>(null);

  async function testSignIn() {
    setResult({ loading: true });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setResult({
        success: !error,
        error: error?.message,
        data: data,
        user: data.user,
        session: data.session,
      });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  async function checkUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    setResult({
      currentUser: user,
      error: error?.message,
    });
  }

  async function checkSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    setResult({
      currentSession: session,
      error: error?.message,
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Auth Debug Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={testSignIn}>Test Sign In</Button>
            <Button onClick={checkUser} variant="outline">
              Check Current User
            </Button>
            <Button onClick={checkSession} variant="outline">
              Check Session
            </Button>
          </div>

          {result && (
            <div className="mt-4 p-4 bg-gray-100 rounded-md overflow-auto max-h-96">
              <pre className="text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
