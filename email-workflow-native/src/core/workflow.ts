// src/core/workflow.ts
import { promises as fs } from 'fs';
import * as path from 'path';

type LogFn = (...args: unknown[]) => void;

export type Task<I, O> = (args: {
  input: I;
  signal: AbortSignal;
  log: LogFn;
}) => Promise<O> | O;

export type TraceEntry = {
  name: string;
  durationMs: number;
  ok: boolean;
  error?: unknown;
  children?: TraceEntry[];
  notes?: string;
};

interface WorkflowOptions {
  logDir?: string; // Folder to store the log file
  logFile?: string; // Custom file name
  verbose?: boolean; // Whether to also log step I/O in console
}

type RunResult<O> = { output: O; trace: TraceEntry[] };

type WorkflowGraphNodeKind =
  | 'start'
  | 'step'
  | 'parallel-group'
  | 'parallel-branch'
  | 'parallel-join'
  | 'fallback-group'
  | 'fallback-primary'
  | 'fallback-secondary'
  | 'fallback-join';

export type WorkflowGraphNode = {
  id: string;
  name: string;
  kind: WorkflowGraphNodeKind;
  metadata?: Record<string, unknown>;
};

export type WorkflowGraphEdge = {
  from: string;
  to: string;
  label?: string;
};

export type WorkflowGraphSnapshot = {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
};

type ParallelResult<TTasks extends Record<string, Task<any, any>>> = {
  [K in keyof TTasks]: Awaited<ReturnType<TTasks[K]>>;
};

export class Workflow<I, O> {
  private readonly fn: (input: I) => Promise<RunResult<O>>;
  private readonly opts: WorkflowOptions;
  private readonly graphBuilder: WorkflowGraphBuilder;
  private readonly tailNodeId: string;

  private constructor(
    fn: (input: I) => Promise<RunResult<O>>,
    opts: WorkflowOptions | undefined,
    graphBuilder: WorkflowGraphBuilder,
    tailNodeId: string
  ) {
    this.fn = fn;
    this.opts = opts ?? {};
    this.graphBuilder = graphBuilder;
    this.tailNodeId = tailNodeId;
  }

  static start(opts?: WorkflowOptions) {
    const graphBuilder = new WorkflowGraphBuilder();
    const startNodeId = graphBuilder.addNode('start', 'Start');
    return new Workflow<void, void>(
      async () => ({ output: undefined, trace: [] }),
      opts,
      graphBuilder,
      startNodeId
    );
  }

  input<NI>() {
    return new Workflow<void, NI>(
      async () => ({ output: undefined as NI, trace: [] }),
      this.opts,
      this.graphBuilder,
      this.tailNodeId
    );
  }

  step<N, NO>(name: string, task: Task<O, NO>): Workflow<I, NO> {
    const nextFn = createSerialRunner<I, O, NO>({
      name,
      task,
      opts: this.opts,
      appendLog: this.appendLog.bind(this),
      previous: this.fn,
    });
    const nextTail = registerStepGraph(this.graphBuilder, this.tailNodeId, name);
    return new Workflow(nextFn, this.opts, this.graphBuilder, nextTail);
  }

  fallback<NO>(
    name: string,
    primaryTask: Task<O, NO>,
    fallbackTask: Task<O, NO>
  ): Workflow<I, NO> {
    const nextFn = createFallbackRunner<I, O, NO>({
      name,
      primaryTask,
      fallbackTask,
      opts: this.opts,
      appendLog: this.appendLog.bind(this),
      previous: this.fn,
    });
    const { joinId } = registerFallbackGraph(
      this.graphBuilder,
      this.tailNodeId,
      name
    );
    return new Workflow(nextFn, this.opts, this.graphBuilder, joinId);
  }

  parallel<TTasks extends Record<string, Task<O, any>>>(
    name: string,
    tasks: TTasks
  ): Workflow<I, ParallelResult<TTasks>> {
    const taskKeys = Object.keys(tasks) as Array<keyof TTasks>;
    if (taskKeys.length === 0) {
      throw new Error(`Parallel step "${name}" requires at least one task.`);
    }

    const nextFn = createParallelRunner<I, O, TTasks>({
      name,
      tasks,
      taskKeys,
      opts: this.opts,
      appendLog: this.appendLog.bind(this),
      previous: this.fn,
    });

    const { joinId } = registerParallelGraph(
      this.graphBuilder,
      this.tailNodeId,
      name,
      taskKeys.map(String)
    );

    return new Workflow(nextFn, this.opts, this.graphBuilder, joinId);
  }

  tap(name: string, fn: (o: O) => void | Promise<void>) {
    return this.step(name, async ({ input }) => {
      await fn(input);
      return input;
    });
  }

  getGraphSnapshot(): WorkflowGraphSnapshot {
    return this.graphBuilder.snapshot();
  }

  visualizeGraph(format: 'dot' | 'mermaid' = 'mermaid') {
    return format === 'dot'
      ? this.graphBuilder.toDot()
      : this.graphBuilder.toMermaid();
  }

  async writeGraphVisualization(
    filePath: string,
    format: 'dot' | 'mermaid' = 'mermaid'
  ) {
    const content = this.visualizeGraph(format);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async run(input: I) {
    const res = await this.fn(input);
    return res;
  }

  private async appendLog(lines: string[]) {
    if (!this.opts.logDir) return;
    const fileName = this.opts.logFile ?? 'pipeline.log';
    const filePath = path.join(this.opts.logDir, fileName);
    await fs.appendFile(filePath, lines.join('\n') + '\n', 'utf-8');
  }
}

type SerialRunnerArgs<I, O, NO> = {
  name: string;
  task: Task<O, NO>;
  opts: WorkflowOptions;
  appendLog: (lines: string[]) => Promise<void>;
  previous: (input: I) => Promise<RunResult<O>>;
};

function createSerialRunner<I, O, NO>({
  name,
  task,
  opts,
  appendLog,
  previous,
}: SerialRunnerArgs<I, O, NO>) {
  return async (input: I) => {
    const prev = await previous(input);
    const header = createSectionHeader('STEP', name, prev.output);
    const attempt = await runTaskAttempt<O, NO>({
      name,
      logLabel: name,
      task,
      input: prev.output,
      opts,
    });

    if (attempt.ok) {
      const footer = createSuccessFooter('STEP', name, attempt.output, attempt.durationMs);
      await appendLog([...header, ...attempt.logLines, ...footer]);
      return {
        output: attempt.output,
        trace: [...prev.trace, attempt.traceEntry],
      };
    }

    const footer = createFailureFooter('STEP', name, attempt.error, attempt.durationMs);
    await appendLog([...header, ...attempt.logLines, ...footer]);
    throwWithTrace(prev.trace, attempt.traceEntry, attempt.error);
  };
}

type FallbackRunnerArgs<I, O, NO> = {
  name: string;
  primaryTask: Task<O, NO>;
  fallbackTask: Task<O, NO>;
  opts: WorkflowOptions;
  appendLog: (lines: string[]) => Promise<void>;
  previous: (input: I) => Promise<RunResult<O>>;
};

function createFallbackRunner<I, O, NO>({
  name,
  primaryTask,
  fallbackTask,
  opts,
  appendLog,
  previous,
}: FallbackRunnerArgs<I, O, NO>) {
  return async (input: I) => {
    const prev = await previous(input);
    const start = Date.now();
    const header = createSectionHeader('FALLBACK', name, prev.output);

    const primaryAttempt = await runTaskAttempt<O, NO>({
      name: `${name}::primary`,
      logLabel: `${name}::primary`,
      task: primaryTask,
      input: prev.output,
      opts,
    });

    const body: string[] = [...primaryAttempt.logLines];

    if (primaryAttempt.ok) {
      body.push('[FALLBACK] Primary succeeded; fallback skipped.');
      const durationMs = Date.now() - start;
      const entry: TraceEntry = {
        name,
        durationMs,
        ok: true,
        children: [primaryAttempt.traceEntry],
        notes: 'Primary task succeeded; fallback not executed.',
      };
      const footer = createSuccessFooter(
        'FALLBACK',
        name,
        primaryAttempt.output,
        durationMs
      );
      await appendLog([...header, ...body, ...footer]);
      return {
        output: primaryAttempt.output,
        trace: [...prev.trace, entry],
      };
    }

    const primaryError = primaryAttempt.error;
    body.push(
      `[FALLBACK] Primary failed: ${summarizeError(primaryError)}. Executing fallback.`
    );

    const fallbackAttempt = await runTaskAttempt<O, NO>({
      name: `${name}::fallback`,
      logLabel: `${name}::fallback`,
      task: fallbackTask,
      input: prev.output,
      opts,
    });

    body.push(...fallbackAttempt.logLines);

    const durationMs = Date.now() - start;
    const entry: TraceEntry = {
      name,
      durationMs,
      ok: fallbackAttempt.ok,
      error: fallbackAttempt.ok ? undefined : fallbackAttempt.error,
      children: [primaryAttempt.traceEntry, fallbackAttempt.traceEntry],
      notes: fallbackAttempt.ok
        ? `Fallback executed after primary failure: ${summarizeError(primaryError)}`
        : `Fallback failed after primary failure: ${summarizeError(primaryError)}`,
    };

    if (fallbackAttempt.ok) {
      const footer = createSuccessFooter(
        'FALLBACK',
        name,
        fallbackAttempt.output,
        durationMs
      );
      await appendLog([...header, ...body, ...footer]);
      return {
        output: fallbackAttempt.output,
        trace: [...prev.trace, entry],
      };
    }

    const footer = createFailureFooter(
      'FALLBACK',
      name,
      fallbackAttempt.error,
      durationMs
    );
    await appendLog([...header, ...body, ...footer]);
    throwWithTrace(prev.trace, entry, fallbackAttempt.error);
  };
}

type ParallelRunnerArgs<I, O, TTasks extends Record<string, Task<O, any>>> = {
  name: string;
  tasks: TTasks;
  taskKeys: Array<keyof TTasks>;
  opts: WorkflowOptions;
  appendLog: (lines: string[]) => Promise<void>;
  previous: (input: I) => Promise<RunResult<O>>;
};

function createParallelRunner<I, O, TTasks extends Record<string, Task<O, any>>>({
  name,
  tasks,
  taskKeys,
  opts,
  appendLog,
  previous,
}: ParallelRunnerArgs<I, O, TTasks>) {
  return async (input: I) => {
    const prev = await previous(input);
    const start = Date.now();
    const header = createSectionHeader('PARALLEL', name, prev.output);

    const branchAttempts = await Promise.all(
      taskKeys.map(async (key) => ({
        key,
        attempt: await runTaskAttempt<O, ParallelResult<TTasks>[typeof key]>({
          name: `${name}::${String(key)}`,
          logLabel: `${name}::${String(key)}`,
          task: tasks[key],
          input: prev.output,
          opts,
        }),
      }))
    );

    const body: string[] = [];
    branchAttempts.forEach(({ key, attempt }, index) => {
      if (index > 0) body.push('');
      body.push(
        `[PARALLEL] Branch ${String(key)} (${attempt.ok ? 'ok' : 'error'}) completed in ${attempt.durationMs}ms.`
      );
      body.push(...attempt.logLines);
    });

    const durationMs = Date.now() - start;
    const children = branchAttempts.map(({ attempt }) => attempt.traceEntry);

    const failureAttempts = branchAttempts.filter(
      (item): item is { key: keyof TTasks; attempt: TaskAttemptFailure } =>
        isFailure(item.attempt)
    );

    const failures = failureAttempts.map(({ key, attempt }) => ({
      key: String(key),
      error: attempt.error,
    }));

    if (failures.length === 0) {
      const aggregatedOutput: Partial<ParallelResult<TTasks>> = {};
      branchAttempts.forEach(({ key, attempt }) => {
        if (attempt.ok) {
          (aggregatedOutput as ParallelResult<TTasks>)[key] = attempt.output;
        }
      });

      const entry: TraceEntry = {
        name,
        durationMs,
        ok: true,
        children,
      };

      const footer = createSuccessFooter(
        'PARALLEL',
        name,
        aggregatedOutput,
        durationMs
      );
      await appendLog([...header, ...body, ...footer]);
      return {
        output: aggregatedOutput as ParallelResult<TTasks>,
        trace: [...prev.trace, entry],
      };
    }

    body.push('');
    body.push(
      `[PARALLEL] ${failures.length} branch(es) failed in group "${name}".`
    );

    const error = createParallelError(name, failures);
    const entry: TraceEntry = {
      name,
      durationMs,
      ok: false,
      error,
      children,
    };
    const footer = createFailureFooter('PARALLEL', name, error, durationMs);
    await appendLog([...header, ...body, ...footer]);
    throwWithTrace(prev.trace, entry, error);
  };
}

type TaskAttemptSuccess<O> = {
  ok: true;
  output: O;
  durationMs: number;
  logLines: string[];
  traceEntry: TraceEntry;
};

type TaskAttemptFailure = {
  ok: false;
  error: unknown;
  durationMs: number;
  logLines: string[];
  traceEntry: TraceEntry;
};

type TaskAttemptResult<O> = TaskAttemptSuccess<O> | TaskAttemptFailure;

type TaskAttemptArgs<I, O> = {
  name: string;
  logLabel: string;
  task: Task<I, O>;
  input: I;
  opts: WorkflowOptions;
};

async function runTaskAttempt<I, O>({
  name,
  logLabel,
  task,
  input,
  opts,
}: TaskAttemptArgs<I, O>): Promise<TaskAttemptResult<O>> {
  const start = Date.now();
  const controller = new AbortController();
  const logLines: string[] = [];
  const log: LogFn = (...args) => {
    const message = args.map(formatLogArg).join(' ');
    logLines.push(`[${logLabel}] ${message}`);
    if (opts.verbose) console.log(`[${logLabel}]`, ...args);
  };

  try {
    const output = await task({
      input,
      signal: controller.signal,
      log,
    });
    const durationMs = Date.now() - start;
    return {
      ok: true,
      output,
      durationMs,
      logLines,
      traceEntry: {
        name,
        durationMs,
        ok: true,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    return {
      ok: false,
      error,
      durationMs,
      logLines,
      traceEntry: {
        name,
        durationMs,
        ok: false,
        error,
      },
    };
  }
}

function isFailure<O>(
  attempt: TaskAttemptResult<O>
): attempt is TaskAttemptFailure {
  return !attempt.ok;
}

function throwWithTrace(
  prevTrace: TraceEntry[],
  entry: TraceEntry,
  error: unknown
): never {
  throw { trace: [...prevTrace, entry], error };
}

function createSectionHeader(kind: string, name: string, input: unknown) {
  return [
    '',
    `-------------- ${kind}: ${name} --------------`,
    `[TIME] ${new Date().toISOString()}`,
    `[INPUT] ${safeJson(input)}`,
    '',
  ];
}

function createSuccessFooter(
  kind: string,
  name: string,
  output: unknown,
  durationMs: number
) {
  return [
    '',
    `[OUTPUT] ${safeJson(output)}`,
    `-------------- END ${kind}: ${name} (${durationMs}ms) --------------`,
    '',
  ];
}

function createFailureFooter(
  kind: string,
  name: string,
  error: unknown,
  durationMs: number
) {
  return [
    '',
    `[ERROR] ${summarizeError(error)}`,
    `-------------- END ${kind}: ${name} (FAILED) --------------`,
    '',
  ];
}

function safeJson(value: unknown) {
  try {
    const json = JSON.stringify(value, null, 2);
    return json === undefined ? 'undefined' : json;
  } catch {
    return '"[unserializable]"';
  }
}

function formatLogArg(arg: unknown) {
  if (
    arg === null ||
    typeof arg === 'number' ||
    typeof arg === 'boolean' ||
    typeof arg === 'undefined'
  ) {
    return String(arg);
  }
  if (typeof arg === 'string') return arg;
  return safeJson(arg);
}

function summarizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return safeJson(error);
}

function createParallelError(
  name: string,
  failures: Array<{ key: string; error: unknown }>
) {
  if (failures.length === 1) {
    const [{ key, error }] = failures;
    if (error instanceof Error) return error;
    return new Error(
      `Parallel branch "${key}" failed: ${summarizeError(error)}`
    );
  }

  const messageLines = [
    `Parallel step "${name}" failed in ${failures.length} branches:`,
    ...failures.map(
      ({ key, error }) => `- ${key}: ${summarizeError(error)}`
    ),
  ];
  const aggregate = new Error(messageLines.join('\n'));
  (aggregate as { causes?: unknown[] }).causes = failures.map(
    ({ error }) => error
  );
  return aggregate;
}

class WorkflowGraphBuilder {
  private counter = 0;
  private readonly nodes = new Map<string, WorkflowGraphNode>();
  private readonly edges: WorkflowGraphEdge[] = [];

  addNode(
    kind: WorkflowGraphNodeKind,
    name: string,
    metadata?: Record<string, unknown>,
    explicitId?: string
  ) {
    const id = explicitId ?? `${kind}-${++this.counter}`;
    if (this.nodes.has(id)) {
      throw new Error(`Workflow graph already contains node id "${id}"`);
    }
    this.nodes.set(id, { id, name, kind, metadata });
    return id;
  }

  addEdge(from: string, to: string, label?: string) {
    this.edges.push({ from, to, label });
  }

  snapshot(): WorkflowGraphSnapshot {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges],
    };
  }

  toDot() {
    const lines: string[] = ['digraph Workflow {', '  rankdir=LR;'];
    for (const node of this.nodes.values()) {
      const { shape, style } = resolveNodeStyle(node.kind);
      const attrs = [`label=${quote(node.name)}`];
      if (shape) attrs.push(`shape=${shape}`);
      if (style) attrs.push(`style=${style}`);
      lines.push(`  ${quote(node.id)} [${attrs.join(', ')}];`);
    }
    for (const edge of this.edges) {
      const attrs = edge.label ? ` [label=${quote(edge.label)}]` : '';
      lines.push(`  ${quote(edge.from)} -> ${quote(edge.to)}${attrs};`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  toMermaid() {
    const idMap = new Map<string, string>();
    const lines: string[] = ['flowchart LR'];
    for (const node of this.nodes.values()) {
      const id = sanitizeId(node.id, idMap);
      lines.push(`  ${id}${mermaidNodeBody(node)}`);
    }
    for (const edge of this.edges) {
      const fromId = sanitizeId(edge.from, idMap);
      const toId = sanitizeId(edge.to, idMap);
      const label = edge.label
        ? `|${escapeMermaidLabel(edge.label)}|`
        : '';
      lines.push(`  ${fromId} -->${label} ${toId}`);
    }
    return lines.join('\n');
  }
}

function registerStepGraph(
  builder: WorkflowGraphBuilder,
  tailNodeId: string,
  name: string
) {
  const nodeId = builder.addNode('step', name);
  builder.addEdge(tailNodeId, nodeId);
  return nodeId;
}

function registerFallbackGraph(
  builder: WorkflowGraphBuilder,
  tailNodeId: string,
  name: string
) {
  const groupId = builder.addNode('fallback-group', name);
  const primaryId = builder.addNode(
    'fallback-primary',
    `${name}::primary`,
    { role: 'primary' }
  );
  const fallbackId = builder.addNode(
    'fallback-secondary',
    `${name}::fallback`,
    { role: 'fallback' }
  );
  const joinId = builder.addNode('fallback-join', `${name}::join`);

  builder.addEdge(tailNodeId, groupId);
  builder.addEdge(groupId, primaryId, 'primary');
  builder.addEdge(groupId, fallbackId, 'fallback');
  builder.addEdge(primaryId, joinId);
  builder.addEdge(fallbackId, joinId);

  return { groupId, primaryId, fallbackId, joinId };
}

function registerParallelGraph(
  builder: WorkflowGraphBuilder,
  tailNodeId: string,
  name: string,
  branchKeys: string[]
) {
  const groupId = builder.addNode('parallel-group', name);
  const joinId = builder.addNode('parallel-join', `${name}::join`);
  builder.addEdge(tailNodeId, groupId);

  branchKeys.forEach((key) => {
    const branchId = builder.addNode(
      'parallel-branch',
      `${name}::${key}`,
      { branch: key }
    );
    builder.addEdge(groupId, branchId, key);
    builder.addEdge(branchId, joinId);
  });

  return { groupId, joinId };
}

function resolveNodeStyle(kind: WorkflowGraphNodeKind) {
  switch (kind) {
    case 'start':
      return { shape: 'circle', style: 'filled' };
    case 'parallel-group':
    case 'fallback-group':
      return { shape: 'diamond', style: undefined };
    case 'parallel-join':
    case 'fallback-join':
      return { shape: 'oval', style: 'dashed' };
    default:
      return { shape: 'box', style: 'rounded' };
  }
}

function quote(value: string) {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

function sanitizeId(
  value: string,
  idMap: Map<string, string>
) {
  if (idMap.has(value)) return idMap.get(value)!;
  const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '_');
  const unique =
    sanitized && !Array.from(idMap.values()).includes(sanitized)
      ? sanitized
      : `node_${idMap.size}`;
  idMap.set(value, unique);
  return unique;
}

function mermaidNodeBody(node: WorkflowGraphNode) {
  const label = escapeMermaidLabel(node.name);
  switch (node.kind) {
    case 'start':
      return `((${label}))`;
    case 'parallel-group':
    case 'fallback-group':
      return `{${label}}`;
    case 'parallel-join':
    case 'fallback-join':
      return `[[${label}]]`;
    default:
      return `["${label}"]`;
  }
}

function escapeMermaidLabel(value: string) {
  return value.replace(/["{}[\]()]/g, '\\$&');
}
