import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CascadeSankeyProps {
  sqlVolume: number;
  opportunityVolume: number;
  revenueAmount: number;
  conversionRate: number;
  winRate: number;
  timeDistribution: {
    sameQuarter: number;
    nextQuarter: number;
    twoQuartersLater: number;
  };
}

export function CascadeSankey({
  sqlVolume,
  opportunityVolume,
  revenueAmount,
  conversionRate,
  winRate,
  timeDistribution,
}: CascadeSankeyProps) {

  const initialNodes: Node[] = useMemo(() => [
    // SQL Node
    {
      id: 'sql',
      type: 'input',
      data: {
        label: (
          <div className="px-4 py-3 bg-blue-500 text-white rounded border-2 border-blue-600">
            <div className="text-xs font-semibold mb-1">SQLs</div>
            <div className="text-xl font-bold">{sqlVolume.toLocaleString()}</div>
          </div>
        ),
      },
      position: { x: 50, y: 200 },
      sourcePosition: Position.Right,
    },
    // Opportunity Nodes (time-based) - Simplified to single combined node
    {
      id: 'opp',
      data: {
        label: (
          <div className="px-4 py-3 bg-purple-500 text-white rounded border-2 border-purple-600">
            <div className="text-xs font-semibold mb-1">Opportunities</div>
            <div className="text-xl font-bold">{opportunityVolume.toLocaleString()}</div>
          </div>
        ),
      },
      position: { x: 400, y: 200 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    // Revenue Node
    {
      id: 'revenue',
      type: 'output',
      data: {
        label: (
          <div className="px-3 py-2 bg-green-500 text-white rounded border-2 border-green-600">
            <div className="text-[10px] font-semibold mb-0.5 leading-tight">Revenue</div>
            <div className="text-base font-bold leading-tight">${(revenueAmount / 1000).toLocaleString()}K</div>
          </div>
        ),
      },
      position: { x: 750, y: 200 },
      targetPosition: Position.Left,
    },
  ], [sqlVolume, opportunityVolume, revenueAmount]);

  const initialEdges: Edge[] = useMemo(() => [
    // SQL to Opportunities
    {
      id: 'sql-opp',
      source: 'sql',
      target: 'opp',
      animated: true,
      style: { stroke: '#10b981', strokeWidth: 3 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    },
    // Opportunities to Revenue
    {
      id: 'opp-revenue',
      source: 'opp',
      target: 'revenue',
      animated: true,
      style: { stroke: '#10b981', strokeWidth: 3 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    },
  ], []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cascade Flow Visualization</CardTitle>
        <CardDescription>
          Interactive view of SQL → Opportunity → Revenue conversion with time-based distribution
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: '500px', width: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>SQLs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Opportunities</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Revenue</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
