import { useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
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

/**
 * CascadeSankey Component
 * 
 * Displays an interactive Sankey diagram visualizing the revenue cascade flow:
 * SQLs → Opportunities → Revenue (New Business + Upsell)
 * 
 * Uses ReactFlow to create an interactive flow diagram showing:
 * - SQL volume as the starting point
 * - Opportunity conversion with time distribution (same quarter, next quarter, two quarters later)
 * - Revenue split between new business and upsell opportunities
 * 
 * @param sqlVolume - Total SQL (Sales Qualified Lead) volume
 * @param opportunityVolume - Total opportunity volume
 * @param revenueAmount - Total revenue amount in dollars
 * @param conversionRate - SQL to Opportunity conversion rate (as percentage)
 * @param winRate - Opportunity to Revenue win rate (as percentage)
 * @param timeDistribution - Distribution of opportunities across time periods
 * 
 * @returns A card component containing an interactive ReactFlow Sankey diagram
 */
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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const fitViewTriggered = useRef(false);
  const prevPropsRef = useRef({ sqlVolume: 0, opportunityVolume: 0, revenueAmount: 0 });

  // Update nodes when props change (e.g., when switching companies)
  // Use ref to track previous values and force update when they actually change
  useEffect(() => {
    const propsChanged = 
      prevPropsRef.current.sqlVolume !== sqlVolume ||
      prevPropsRef.current.opportunityVolume !== opportunityVolume ||
      prevPropsRef.current.revenueAmount !== revenueAmount;
    
    if (propsChanged) {
      // Update ref with new values
      prevPropsRef.current = { sqlVolume, opportunityVolume, revenueAmount };
      
      // Create completely new node objects with fresh data
      const newNodes = initialNodes.map((node, index) => ({
        ...node,
        id: node.id,
        data: {
          ...node.data,
          // Force new label by recreating it
          label: node.data.label,
        },
      }));
      
      setNodes(newNodes);
      fitViewTriggered.current = false; // Reset fitView trigger
    }
  }, [sqlVolume, opportunityVolume, revenueAmount, initialNodes, setNodes]);

  // Update edges when they change (though they're static in this case)
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Component to handle fitView after nodes are updated
  function FitViewOnUpdate() {
    const { fitView } = useReactFlow();
    
    useEffect(() => {
      if (!fitViewTriggered.current && nodes.length > 0) {
        // Small delay to ensure nodes are rendered
        const timer = setTimeout(() => {
          fitView({ padding: 0.1, duration: 300 });
          fitViewTriggered.current = true;
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [nodes, fitView]);
    
    return null;
  }

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
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            minZoom={1}
            maxZoom={1}
          >
            <Background />
            <Controls showZoom={false} showFitView={true} showInteractive={false} />
            <FitViewOnUpdate />
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
