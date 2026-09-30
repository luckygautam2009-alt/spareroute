import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  FileText,
  User,
  ShoppingBag,
  CreditCard,
  Ticket,
  BookOpen,
  Search,
  Scale,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

// ── Node status styles ────────────────────────────────────────────────────────
const STATUS_STYLES = {
  verified: {
    borderLeft: '#10B981',
    badgeBg: 'rgba(16, 185, 129, 0.14)',
    badgeText: '#10B981',
    dot: '#10B981',
    label: 'Verified',
  },
  resolved: {
    borderLeft: '#10B981',
    badgeBg: 'rgba(16, 185, 129, 0.14)',
    badgeText: '#10B981',
    dot: '#10B981',
    label: 'Resolved',
  },
  AUTO_RESOLVE: {
    borderLeft: '#10B981',
    badgeBg: 'rgba(16, 185, 129, 0.14)',
    badgeText: '#10B981',
    dot: '#10B981',
    label: 'Auto Resolve',
  },
  flagged: {
    borderLeft: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.14)',
    badgeText: '#F59E0B',
    dot: '#F59E0B',
    label: 'Flagged',
  },
  matched: {
    borderLeft: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.14)',
    badgeText: '#F59E0B',
    dot: '#F59E0B',
    label: 'Matched',
  },
  CUSTOMER_CONFIRM: {
    borderLeft: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.14)',
    badgeText: '#F59E0B',
    dot: '#F59E0B',
    label: 'Confirmation',
  },
  escalated: {
    borderLeft: '#EF4444',
    badgeBg: 'rgba(239, 68, 68, 0.14)',
    badgeText: '#EF4444',
    dot: '#EF4444',
    label: 'Escalated',
  },
  HUMAN_ESCALATION: {
    borderLeft: '#EF4444',
    badgeBg: 'rgba(239, 68, 68, 0.14)',
    badgeText: '#EF4444',
    dot: '#EF4444',
    label: 'Human Agent',
  },
  found: {
    borderLeft: '#3B82F6',
    badgeBg: 'rgba(59, 130, 246, 0.14)',
    badgeText: '#3B82F6',
    dot: '#3B82F6',
    label: 'Found',
  },
  analyzed: {
    borderLeft: '#8B5CF6',
    badgeBg: 'rgba(139, 92, 246, 0.14)',
    badgeText: '#8B5CF6',
    dot: '#8B5CF6',
    label: 'Analyzed',
  },
};

const TYPE_ICONS = {
  complaint: FileText,
  customer: User,
  order: ShoppingBag,
  payment: CreditCard,
  ticket: Ticket,
  refund: RefreshCw,
  security: ShieldAlert,
  policy: BookOpen,
  rootcause: Search,
  rootCause: Search,
  action: Scale,
  decision: Scale,
};

// ── Custom Node Component ─────────────────────────────────────────────────────
function EvidenceNode({ data }) {
  const style = STATUS_STYLES[data.status] || STATUS_STYLES.analyzed;
  const Icon = TYPE_ICONS[data.type] || FileText;

  return (
    <div
      className="graph-node select-none"
      style={{
        borderLeft: `5px solid ${style.borderLeft}`,
        padding: '12px 14px',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-amber !border-2 !border-surface"
      />

      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: style.badgeBg }}
        >
          <Icon className="w-4 h-4" style={{ color: style.borderLeft }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: style.borderLeft }}
            >
              {data.type?.toUpperCase()}
            </span>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: style.dot }}
            />
          </div>

          <div
            className="font-semibold text-paper text-[13.5px] leading-snug line-clamp-2"
            title={data.label}
          >
            {data.label}
          </div>

          {data.sublabel && (
            <div className="text-[11.5px] mt-1 text-muted leading-tight truncate">
              {data.sublabel}
            </div>
          )}
        </div>
      </div>

      {data.badge && (
        <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
          <span
            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            style={{ background: style.badgeBg, color: style.badgeText }}
          >
            {data.badge}
          </span>
          <span className="text-[10px] text-muted font-medium">
            {style.label}
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-amber !border-2 !border-surface"
      />
    </div>
  );
}

const nodeTypes = { evidence: EvidenceNode };

// ── Smart Multi-Column Timeline Layout ─────────────────────────────────────────
function getStage(node) {
  const type = (node.type || '').toLowerCase();
  const id = (node.id || '').toLowerCase();

  if (type === 'complaint' || id === 'complaint') return 0;
  if (type === 'ticket' || id.startsWith('ticket')) return 1;
  if (type === 'security' || id.startsWith('security')) return 1;
  if (type === 'order' || id.startsWith('order')) return 2;
  if (type === 'payment' || id.startsWith('payment')) return 2;
  if (type === 'refund' || id.startsWith('refund')) return 2;
  if (type === 'policy' || id.startsWith('policy')) return 3;
  if (type === 'rootcause' || id === 'root-cause') return 4;
  if (type === 'action' || id === 'recommended-action' || type === 'decision') return 5;
  return 2;
}

function layoutNodes(rawNodes) {
  if (!rawNodes.length) return [];

  // Group nodes by stage
  const stageMap = {};
  rawNodes.forEach((node) => {
    const stage = getStage(node);
    if (!stageMap[stage]) stageMap[stage] = [];
    stageMap[stage].push(node);
  });

  // Compress active stages so there are no empty gap columns
  const activeStages = Object.keys(stageMap)
    .map(Number)
    .sort((a, b) => a - b);

  const COL_WIDTH = 300;
  const CARD_HEIGHT = 100;
  const VERTICAL_GAP = 30;
  const CANVAS_CENTER_Y = 250;

  const positionedNodes = [];

  activeStages.forEach((stage, colIndex) => {
    const nodesInStage = stageMap[stage];
    const count = nodesInStage.length;
    const totalHeight = count * CARD_HEIGHT + (count - 1) * VERTICAL_GAP;
    const startY = Math.max(40, CANVAS_CENTER_Y - totalHeight / 2);

    nodesInStage.forEach((node, rowIndex) => {
      const x = 50 + colIndex * COL_WIDTH;
      const y = startY + rowIndex * (CARD_HEIGHT + VERTICAL_GAP);

      positionedNodes.push({
        ...node,
        position: { x, y },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });
  });

  return positionedNodes;
}

// ── Main EvidenceGraph Component ──────────────────────────────────────────────
export default function EvidenceGraph({ evidenceGraph }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useRef(null);

  const buildGraph = useCallback(() => {
    if (!evidenceGraph?.nodes?.length) return;

    const rawNodes = evidenceGraph.nodes.map((n) => ({
      id: n.id,
      type: 'evidence',
      data: {
        label: n.label,
        sublabel:
          n.data?.id || n.data?.amount || n.data?.product || n.data?.subject
            ? [
                n.data.id,
                n.data.product,
                n.data.amount ? `₹${n.data.amount}` : '',
                n.data.subject,
              ]
                .filter(Boolean)
                .join(' · ')
            : null,
        badge: n.data?.status || n.data?.decision || (n.data?.flagged ? 'FLAGGED' : null),
        status: n.status || 'analyzed',
        type: n.type,
      },
      position: { x: 0, y: 0 },
      draggable: true,
    }));

    const rawEdges = (evidenceGraph.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: '#D97706',
      },
      style: {
        stroke: '#D97706',
        strokeWidth: 2.2,
      },
    }));

    const positioned = layoutNodes(rawNodes);
    setNodes(positioned);
    setEdges(rawEdges);
  }, [evidenceGraph, setNodes, setEdges]);

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  // Re-fit view whenever nodes update
  useEffect(() => {
    if (reactFlowInstance.current && nodes.length > 0) {
      const timer = setTimeout(() => {
        reactFlowInstance.current?.fitView({ padding: 0.25, duration: 400 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes]);

  const handleInit = (instance) => {
    reactFlowInstance.current = instance;
    setTimeout(() => {
      instance.fitView({ padding: 0.25, duration: 400 });
    }, 120);
  };

  const handleResetView = () => {
    reactFlowInstance.current?.fitView({ padding: 0.25, duration: 400 });
  };

  if (!evidenceGraph?.nodes?.length) {
    return (
      <div className="h-[520px] flex flex-col items-center justify-center border border-border rounded-xl bg-ink-light/50">
        <FileText className="w-8 h-8 text-muted/60 mb-2" />
        <p className="text-muted text-sm font-medium">No evidence graph available</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border-strong bg-ink shadow-sm">
      {/* Top Legend Bar */}
      <div className="absolute top-3 left-3 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-ink-light/90 border border-border backdrop-blur-md text-[11px] font-medium text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-verified" /> Verified
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber" /> Flagged / Matched
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-alert" /> Escalated
        </span>
      </div>

      {/* Recenter button */}
      <button
        type="button"
        onClick={handleResetView}
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-ink-light/90 hover:bg-ink-lighter border border-border backdrop-blur-md text-xs font-semibold text-paper transition-colors shadow-sm cursor-pointer"
        title="Auto-fit view"
      >
        <ArrowRight className="w-3.5 h-3.5 text-amber rotate-45" />
        Fit View
      </button>

      {/* ReactFlow Canvas with min-height 540px */}
      <div style={{ height: 540, width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={handleInit}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={1.6}
          attributionPosition="bottom-right"
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color="var(--rf-dot-color)"
          />
          <Controls showInteractive={false} className="!m-3" />
          <MiniMap
            nodeColor={(n) => {
              const s = n.data?.status;
              if (s === 'flagged' || s === 'matched' || s === 'CUSTOMER_CONFIRM') return '#F59E0B';
              if (s === 'verified' || s === 'resolved' || s === 'AUTO_RESOLVE') return '#10B981';
              if (s === 'escalated' || s === 'HUMAN_ESCALATION') return '#EF4444';
              return '#3B82F6';
            }}
            maskColor="var(--rf-minimap-mask)"
            style={{
              width: 140,
              height: 90,
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
