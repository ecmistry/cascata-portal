import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TrendingUp, TrendingDown, Trash2, Eye, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Scenarios() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const companyId = parseInt(params.id || "1");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<number | null>(null);

  // Fetch scenarios
  const { data: scenarios = [], isLoading, refetch } = trpc.scenario.list.useQuery(
    { companyId },
    { refetchOnWindowFocus: false }
  );

  // Delete scenario mutation
  const deleteScenario = trpc.scenario.delete.useMutation({
    onSuccess: () => {
      toast.success("Scenario deleted successfully");
      refetch();
      setDeleteDialogOpen(false);
      setScenarioToDelete(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete scenario: ${error.message}`);
    },
  });

  const handleDeleteClick = (id: number) => {
    setScenarioToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (scenarioToDelete) {
      deleteScenario.mutate({ id: scenarioToDelete });
    }
  };

  const formatAdjustment = (value: number | null, unit: string) => {
    if (value === null || value === 0) return "No change";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}${unit}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saved Scenarios</h1>
          <p className="text-muted-foreground mt-2">
            View and compare your What-If scenarios
          </p>
        </div>
        <Button onClick={() => setLocation(`/whatif/${companyId}`)}>
          Create New Scenario
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground mb-4">No saved scenarios yet</p>
            <Button onClick={() => setLocation(`/whatif/${companyId}`)}>
              Create Your First Scenario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Scenarios ({scenarios.length})</CardTitle>
            <CardDescription>
              Click on a scenario to view details or compare with others
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Revenue Impact</TableHead>
                  <TableHead>Opportunities Impact</TableHead>
                  <TableHead>Key Adjustments</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((scenario) => (
                  <TableRow key={scenario.id}>
                    <TableCell className="font-medium">{scenario.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {scenario.description || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {scenario.totalRevenueChange !== null && (
                          <>
                            <span className="font-medium">
                              ${Math.abs(scenario.totalRevenueChange / 100).toLocaleString()}
                            </span>
                            {scenario.totalRevenueChange >= 0 ? (
                              <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-500" />
                            )}
                            <span
                              className={`text-sm ${
                                scenario.totalRevenueChange >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {scenario.totalRevenueChangePercent !== null
                                ? `${(scenario.totalRevenueChangePercent / 100).toFixed(1)}%`
                                : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {scenario.totalOpportunitiesChange !== null && (
                          <>
                            <span className="font-medium">
                              {scenario.totalOpportunitiesChange >= 0 ? "+" : ""}
                              {scenario.totalOpportunitiesChange}
                            </span>
                            <span
                              className={`text-sm ${
                                scenario.totalOpportunitiesChange >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {scenario.totalOpportunitiesChangePercent !== null
                                ? `${(scenario.totalOpportunitiesChangePercent / 100).toFixed(1)}%`
                                : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {scenario.conversionRateMultiplier !== null &&
                          scenario.conversionRateMultiplier !== 10000 && (
                            <Badge variant="secondary" className="text-xs">
                              Conv: {(scenario.conversionRateMultiplier / 10000).toFixed(2)}x
                            </Badge>
                          )}
                        {scenario.acvNewAdjustment !== null &&
                          scenario.acvNewAdjustment !== 0 && (
                            <Badge variant="secondary" className="text-xs">
                              ACV New: {formatAdjustment(scenario.acvNewAdjustment / 100, "")}
                            </Badge>
                          )}
                        {scenario.sameQuarterAdjustment !== null &&
                          scenario.sameQuarterAdjustment !== 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Same Q: {formatAdjustment(scenario.sameQuarterAdjustment / 100, "%")}
                            </Badge>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(scenario.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/scenario/${scenario.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(scenario.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scenario</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scenario? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteScenario.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      </div>
    </DashboardLayout>
  );
}
