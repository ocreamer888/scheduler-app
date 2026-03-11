// src/components/API-dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Key, Trash2, Eye, EyeOff, Copy, Check, Plus, Activity } from 'lucide-react';

type ApiKeyRow = {
  id: string;
  app_name: string;
  description?: string | null;
  key_preview: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
};

type NewKey = {
  apiKey: string;
  keyId: string;
  appName: string;
  createdAt: string;
};

type FormData = {
  appName: string;
  description: string;
};

export default function APIAdminDashboard() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ appName: '', description: '' });
  const [adminSecret, setAdminSecret] = useState('');

  const adminHeaders = adminSecret ? { 'X-Admin-Secret': adminSecret } : undefined;

  const loadApiKeys = async () => {
    if (!adminHeaders) {
      setApiKeys([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/auth/keys', { headers: adminHeaders, cache: 'no-store' });
      if (res.status === 401) {
        setError('Invalid admin secret');
        setApiKeys([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load keys');
      setApiKeys(data.keys);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load keys';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
   loadApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateApiKey = async () => {
    if (!formData.appName || !adminSecret) {
      alert('Please fill in required fields and admin secret');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/auth/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminSecret,
          appName: formData.appName,
          description: formData.description || undefined
        })
      });
      if (res.status === 401) {
        setError('Invalid admin secret');
        return;
      }
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to generate key');
      setNewKey(payload as NewKey);
      setFormData({ appName: '', description: '' });
      await loadApiKeys();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to generate key';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyStatus = async (keyId: string, nextActive: boolean) => {
    if (!adminHeaders) return;
    try {
        setError(null);
        const res = await fetch(`/api/v1/auth/keys/${keyId}`, {
          method: 'PATCH',
          headers: { ...adminHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: nextActive })
        });
        if (res.status === 401) { setError('Invalid admin secret'); return; }
        await loadApiKeys();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update key';
      setError(errorMessage);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (!adminHeaders) return;
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
        setError(null);
        const res = await fetch(`/api/v1/auth/keys/${keyId}`, {
          method: 'DELETE',
          headers: adminHeaders
        });
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) { setError('Invalid admin secret'); return; }
        if (!res.ok) throw new Error(body?.error || 'Failed to delete key');
        await loadApiKeys();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to delete key';
      setError(errorMessage);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && apiKeys.length === 0) {
    return (
      <div className="min-h-screen bg-black p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto"></div>
          <p className="mt-4 text-gray-100">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/10 rounded-full p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100/10 rounded-full">
                <Key className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-100">API Keys Management</h1>
                <p className="text-gray-100">Manage API keys for external integrations</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="Admin secret"
                className="px-3 py-2 border border-gray-100/430 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={loadApiKeys}
                className="bg-black border border-gray-100/40 text-gray-100 px-4 py-2 rounded-full hover:bg-gray-300 transition"
              >
                Load
              </button>
              <button
                onClick={() => setShowNewKeyModal(true)}
                className="flex items-center text-black gap-2 bg-orange-400 px-4 py-2 rounded-full hover:bg-orange-500 transition"
              >
                <Plus className="w-5 h-5 text-gray-800" />
                Generate New Key
              </button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-sm">Total Keys</p>
                <p className="text-3xl font-bold text-gray-100 mt-1">{apiKeys.length}</p>
              </div>
              <div className="p-3 bg-gray-100/20 rounded-full">
                <Key className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-sm">Active Keys</p>
                <p className="text-3xl font-bold text-green-400 mt-1">
                  {apiKeys.filter(k => k.is_active).length}
                </p>
              </div>
              <div className="p-3 bg-green-100/20 rounded-full">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-sm">Total Requests</p>
                <p className="text-3xl font-bold text-indigo-100 mt-1">
                  {apiKeys.reduce((sum, k) => sum + (k.usage_count || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-indigo-100/20 rounded-full">
                <Activity className="w-6 h-6 text-indigo-200" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/10 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-gray-200/20">
            <h2 className="text-xl font-semibold text-gray-100">Active API Keys</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-300/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase">Application</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase">Key Preview</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase">Last Used</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-100 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white/05 divide-y divide-gray-200/20">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50/10 transition">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-100">{key.app_name}</div>
                        <div className="text-sm text-gray-400">{key.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm bg-gray-100/10 px-2 py-1 rounded">{key.key_preview}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          key.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {key.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-100">
                      {(key.usage_count || 0).toLocaleString()} requests
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-100">{formatDate(key.last_used_at)}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleKeyStatus(key.id, !key.is_active)}
                          className={`p-2 rounded hover:bg-gray-100/20 transition ${
                            key.is_active ? 'text-yellow-400' : 'text-green-600'
                          }`}
                          title={key.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {key.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => deleteKey(key.id)}
                          className="p-2 text-red-500 rounded hover:bg-gray-100/20 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showNewKeyModal && (
          <div className="fixed inset-0 bg-black/80 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-black border border-gray-100/20 rounded-3xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-100 mb-4">Generate New API Key</h2>

              {newKey ? (
                <div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-green-800 font-semibold mb-2">✓ API Key Generated Successfully!</p>
                    <p className="text-sm text-green-700">Save this key now. You won&apos;t be able to see it again!</p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-100 mb-2">Your API Key</label>
                    <div className="flex gap-2">
                      <code className="flex-1 bg-gray-100/10 px-3 py-2 rounded text-sm break-all">{newKey.apiKey}</code>
                      <button
                        onClick={() => copyToClipboard(newKey.apiKey)}
                        className="p-2 bg-orange-400 text-white rounded hover:bg-indigo-700 transition"
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-sm text-gray-100">
                    <p>
                      <strong>App Name:</strong> {newKey.appName}
                    </p>
                    <p>
                      <strong>Key ID:</strong> {newKey.keyId}
                    </p>
                    <p>
                      <strong>Created:</strong> {formatDate(newKey.createdAt)}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setNewKey(null);
                    }}
                    className="w-full bg-orange-400/80 text-white px-4 py-2 rounded-full hover:bg-orange-700/80 transition"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-100 mb-2">Application Name *</label>
                    <input
                      type="text"
                      value={formData.appName}
                      onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-100/20 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="My Website"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-100 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-100/20 rounded-3xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Production website integration"
                      rows={3}
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-100 mb-2">Admin Secret *</label>
                    <input
                      type="password"
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-100/20 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter admin secret"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowNewKeyModal(false)}
                      className="flex-1 bg-gray-200/20 text-gray-100 px-4 py-2 rounded-lg hover:bg-gray-800/40 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={generateApiKey}
                      disabled={loading}
                      className="flex-1 bg-orange-400 text-gray-800 px-4 py-2 rounded-lg hover:bg-orange-500 transition disabled:opacity-50"
                    >
                      {loading ? 'Generating...' : 'Generate Key'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}