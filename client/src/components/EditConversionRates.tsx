import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

interface EditConversionRatesProps {
  companyId: number;
  regions: Array<{ id: number; name: string; displayName: string }>;
  sqlTypes: Array<{ id: number; name: string; displayName: string }>;
  existingData?: {
    id: number;
    regionId: number;
    sqlTypeId: number;
    oppCoverageRatio: number;
    winRateNew: number;
    winRateUpsell: number;
  };
  onSuccess?: () => void;
}

export function EditConversionRates({ companyId, regions, sqlTypes, existingData, onSuccess }: EditConversionRatesProps) {
  const [open, setOpen] = useState(false);
  const [regionId, setRegionId] = useState(existingData?.regionId?.toString() || "");
  const [sqlTypeId, setSqlTypeId] = useState(existingData?.sqlTypeId?.toString() || "");
  const [oppCoverageRatio, setOppCoverageRatio] = useState(
    existingData ? (existingData.oppCoverageRatio / 100).toFixed(2) : ""
  );
  const [winRateNew, setWinRateNew] = useState(
    existingData ? (existingData.winRateNew / 100).toFixed(2) : ""
  );
  const [winRateUpsell, setWinRateUpsell] = useState(
    existingData ? (existingData.winRateUpsell / 100).toFixed(2) : ""
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.conversionRate.upsert.useMutation({
    onSuccess: () => {
      toast.success(existingData ? "Conversion rates updated" : "Conversion rates added");
      utils.conversionRate.list.invalidate();
      setOpen(false);
      onSuccess?.();
      
      // Reset form if adding new
      if (!existingData) {
        setRegionId("");
        setSqlTypeId("");
        setOppCoverageRatio("");
        setWinRateNew("");
        setWinRateUpsell("");
      }
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!regionId || !sqlTypeId || !oppCoverageRatio || !winRateNew || !winRateUpsell) {
      toast.error("Please fill in all fields");
      return;
    }

    upsertMutation.mutate({
      companyId,
      regionId: parseInt(regionId),
      sqlTypeId: parseInt(sqlTypeId),
      oppCoverageRatio: Math.round(parseFloat(oppCoverageRatio) * 100), // Convert to basis points
      winRateNew: Math.round(parseFloat(winRateNew) * 100),
      winRateUpsell: Math.round(parseFloat(winRateUpsell) * 100),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={existingData ? "ghost" : "default"} size={existingData ? "sm" : "default"}>
          {existingData ? (
            <><Pencil className="h-4 w-4" /></>
          ) : (
            <><Plus className="h-4 w-4 mr-2" /> Add Conversion Rate</>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{existingData ? "Edit" : "Add"} Conversion Rates</DialogTitle>
            <DialogDescription>
              {existingData ? "Update" : "Set"} SQL→Opportunity coverage ratio and win rates
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="region" className="text-right">
                Region
              </Label>
              <Select value={regionId} onValueChange={setRegionId} disabled={!!existingData}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sqlType" className="text-right">
                SQL Type
              </Label>
              <Select value={sqlTypeId} onValueChange={setSqlTypeId} disabled={!!existingData}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select SQL type" />
                </SelectTrigger>
                <SelectContent>
                  {sqlTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="oppCoverage" className="text-right">
                SQL→Opp %
              </Label>
              <Input
                id="oppCoverage"
                type="number"
                step="0.01"
                value={oppCoverageRatio}
                onChange={(e) => setOppCoverageRatio(e.target.value)}
                className="col-span-3"
                min="0"
                max="100"
                placeholder="e.g., 5.8"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="winRateNew" className="text-right">
                Win Rate (New)
              </Label>
              <Input
                id="winRateNew"
                type="number"
                step="0.01"
                value={winRateNew}
                onChange={(e) => setWinRateNew(e.target.value)}
                className="col-span-3"
                min="0"
                max="100"
                placeholder="e.g., 25.0"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="winRateUpsell" className="text-right">
                Win Rate (Upsell)
              </Label>
              <Input
                id="winRateUpsell"
                type="number"
                step="0.01"
                value={winRateUpsell}
                onChange={(e) => setWinRateUpsell(e.target.value)}
                className="col-span-3"
                min="0"
                max="100"
                placeholder="e.g., 30.0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
