import { Check, Copy, Database, Play, Plug, Terminal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type?: string;
        description?: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface InitializeResult {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
    title?: string;
  };
  instructions?: string;
}

const DEFAULT_TOOL_ARGS: Record<string, Record<string, unknown>> = {
  get_market_status: {},
  get_stock_quote: { symbol: 'RELIANCE' },
  get_stock_history: { symbol: 'RELIANCE', range: '1y', limitBars: 30 },
  search_nse_stocks: { query: 'TATA', limit: 10 },
  list_scanners: {},
  run_scanner: { scannerId: 'se-prev-day-high', sortBy: 'turnoverCr', limit: 10 },
  get_sector_heatmap: { universe: 'ALL_NSE', category: 'Bank' },
  get_watchlists: {},
  get_portfolio: {},
};

export function McpView() {
  const [serverMeta, setServerMeta] = useState<InitializeResult | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedToolName, setSelectedToolName] = useState<string>('get_stock_quote');
  const [argsText, setArgsText] = useState<string>(
    JSON.stringify(DEFAULT_TOOL_ARGS.get_stock_quote, null, 2),
  );
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastMethodLabel, setLastMethodLabel] = useState<string>('');
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [outputJson, setOutputJson] = useState<string>('');

  const [snippetTab, setSnippetTab] = useState<'mcpJson' | 'curl'>('mcpJson');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const endpointUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : 'http://localhost:3000/api/mcp';

  const loadMcpCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [initRes, toolsRes, resourcesRes] = await Promise.all([
        api.mcpRpc<InitializeResult>('initialize', {
          protocolVersion: '2025-03-26',
          clientInfo: { name: 'nse-pulse-web', version: '1.0.0' },
        }),
        api.mcpRpc<{ tools: McpTool[] }>('tools/list'),
        api.mcpRpc<{ resources: McpResource[] }>('resources/list'),
      ]);

      if (initRes.error) throw new Error(initRes.error.message);
      if (toolsRes.error) throw new Error(toolsRes.error.message);
      if (resourcesRes.error) throw new Error(resourcesRes.error.message);

      setServerMeta(initRes.result || null);
      const list = toolsRes.result?.tools || [];
      setTools(list);
      setResources(resourcesRes.result?.resources || []);
      if (list.length > 0 && !list.some((t) => t.name === selectedToolName)) {
        setSelectedToolName(list[0].name);
        setArgsText(JSON.stringify(DEFAULT_TOOL_ARGS[list[0].name] || {}, null, 2));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to connect to MCP endpoint');
    } finally {
      setLoading(false);
    }
  }, [selectedToolName]);

  useEffect(() => {
    void loadMcpCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTool = tools.find((t) => t.name === selectedToolName) || tools[0] || null;

  const handleSelectTool = (name: string) => {
    setSelectedToolName(name);
    setArgsText(JSON.stringify(DEFAULT_TOOL_ARGS[name] || {}, null, 2));
    setRunError(null);
  };

  const handleRunTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool) return;
    setRunError(null);

    let parsedArgs: Record<string, unknown> = {};
    try {
      const parsed = argsText.trim() ? JSON.parse(argsText) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Arguments must be a JSON object.');
      }
      parsedArgs = parsed as Record<string, unknown>;
    } catch (err) {
      setRunError(err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON arguments');
      return;
    }

    setRunning(true);
    const t0 = performance.now();
    try {
      const res = await api.mcpRpc('tools/call', {
        name: selectedTool.name,
        arguments: parsedArgs,
      });
      setLastDurationMs(Math.round(performance.now() - t0));
      setLastMethodLabel(`tools/call · ${selectedTool.name}`);
      setOutputJson(JSON.stringify(res, null, 2));
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'MCP tool execution failed');
    } finally {
      setRunning(false);
    }
  };

  const handleReadResource = async (uri: string) => {
    setRunning(true);
    setRunError(null);
    const t0 = performance.now();
    try {
      const res = await api.mcpRpc('resources/read', { uri });
      setLastDurationMs(Math.round(performance.now() - t0));
      setLastMethodLabel(`resources/read · ${uri}`);
      setOutputJson(JSON.stringify(res, null, 2));
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to read MCP resource');
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  const mcpJsonSnippet = JSON.stringify(
    {
      mcpServers: {
        'nse-pulse': {
          url: endpointUrl,
          transport: 'http',
        },
      },
    },
    null,
    2,
  );

  const curlSnippet = `curl -s -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_stock_quote","arguments":{"symbol":"RELIANCE"}}}'`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-slate-900 dark:text-slate-100">
            MCP server
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Let Claude Desktop, Cursor or any MCP client read your quotes, history, scanners,
            watchlists and portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
          <span>JSON-RPC 2.0</span>
          <span aria-hidden="true">·</span>
          <span>Protocol {serverMeta?.protocolVersion || '2025-03-26'}</span>
          <span aria-hidden="true">·</span>
          <span>{tools.length} tools</span>
        </div>
      </div>

      {/* Endpoint & Client Setup Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
            <Plug className="h-4 w-4 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            <span>HTTP endpoint</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Send JSON-RPC 2.0 requests via <code className="font-mono">POST /api/mcp</code> or
            inspect discovery metadata at <code className="font-mono">GET /api/mcp</code>.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              {endpointUrl}
            </code>
            <button
              type="button"
              onClick={() => handleCopy('endpoint', endpointUrl)}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {copiedKey === 'endpoint' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy URL
                </>
              )}
            </button>
          </div>

          {/* Live Resources */}
          <div className="mt-4 border-t border-slate-100 pt-3.5 dark:border-slate-800">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Database className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span>Resources ({resources.length})</span>
            </div>
            <div className="space-y-1.5">
              {resources.map((res) => (
                <div
                  key={res.uri}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950/70"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                      {res.uri}
                    </div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {res.description}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => handleReadResource(res.uri)}
                    className="shrink-0 whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-accent-300 hover:text-accent-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-accent-500 dark:hover:text-accent-300"
                  >
                    Read
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Client Config Snippets */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSnippetTab('mcpJson')}
                className={`whitespace-nowrap rounded px-2.5 py-1 font-medium ${
                  snippetTab === 'mcpJson'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Claude / Cursor (mcp.json)
              </button>
              <button
                type="button"
                onClick={() => setSnippetTab('curl')}
                className={`whitespace-nowrap rounded px-2.5 py-1 font-medium ${
                  snippetTab === 'curl'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                cURL Test
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                handleCopy('snippet', snippetTab === 'mcpJson' ? mcpJsonSnippet : curlSnippet)
              }
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {copiedKey === 'snippet' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy config
                </>
              )}
            </button>
          </div>

          <pre className="mt-3 flex-1 overflow-x-auto rounded-md border border-slate-200 bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-800">
            <code>{snippetTab === 'mcpJson' ? mcpJsonSnippet : curlSnippet}</code>
          </pre>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {loadError}
        </div>
      )}

      {/* Interactive MCP Tool Playground */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Registered Tools Catalog */}
        <div className="space-y-2 lg:col-span-5">
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Tools ({tools.length})</span>
            <span className="font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400">
              tools/list
            </span>
          </div>

          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-12 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : (
              tools.map((tool) => {
                const active = selectedTool?.name === tool.name;
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => handleSelectTool(tool.name)}
                    className={`block w-full px-4 py-3 text-left transition-colors ${
                      active
                        ? 'bg-accent-50/70 dark:bg-accent-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          active
                            ? 'text-accent-800 dark:text-accent-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {tool.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                        {Object.keys(tool.inputSchema.properties || {}).length} params
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                      {tool.description}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Tool Runner & JSON-RPC Response */}
        <div className="space-y-4 lg:col-span-7">
          <form
            onSubmit={handleRunTool}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <h2 className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {selectedTool?.name || 'Select a tool'}
                  </h2>
                </div>
                {selectedTool && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {selectedTool.description}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={running || !selectedTool}
                className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {running ? 'Executing...' : 'Run MCP Tool'}
              </button>
            </div>

            {selectedTool && Object.keys(selectedTool.inputSchema.properties || {}).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {Object.entries(selectedTool.inputSchema.properties).map(([key, schema]) => {
                  const req = selectedTool.inputSchema.required?.includes(key);
                  return (
                    <span key={key} className="font-mono">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{key}</span>
                      {req ? '*' : ''} ({schema.type || 'string'}
                      {schema.enum ? `: ${schema.enum.join('|')}` : ''})
                    </span>
                  );
                })}
              </div>
            )}

            <div className="mt-3">
              <label
                htmlFor="mcp-tool-args"
                className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Arguments (JSON)
              </label>
              <textarea
                id="mcp-tool-args"
                rows={4}
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
                spellCheck={false}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-xs text-slate-900 focus:border-accent-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-accent-500"
              />
            </div>

            {runError && (
              <div
                role="alert"
                className="mt-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                {runError}
              </div>
            )}
          </form>

          {/* Response Viewer */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 text-xs dark:border-slate-800">
              <div className="flex items-center gap-2 font-mono text-slate-700 dark:text-slate-300">
                <span className="font-semibold">JSON-RPC 2.0 Response</span>
                {lastMethodLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{lastMethodLabel}</span>
                  </>
                )}
                {lastDurationMs !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {lastDurationMs} ms
                    </span>
                  </>
                )}
              </div>

              {outputJson && (
                <button
                  type="button"
                  onClick={() => handleCopy('response', outputJson)}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {copiedKey === 'response' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      Copy JSON
                    </>
                  )}
                </button>
              )}
            </div>

            {outputJson ? (
              <pre
                data-testid="mcp-response-output"
                className="max-h-[420px] overflow-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-100"
              >
                <code>{outputJson}</code>
              </pre>
            ) : (
              <div className="px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                Select any NSE Pulse tool on the left and click <strong className="font-semibold text-slate-700 dark:text-slate-200">Run tool</strong> (or click <strong className="font-semibold text-slate-700 dark:text-slate-200">Read</strong> on a resource) to inspect the live JSON-RPC 2.0 response.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
