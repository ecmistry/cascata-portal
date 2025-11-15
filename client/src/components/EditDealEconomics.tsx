import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

interface EditDealEconomicsProps {
  companyId: number;
  regions: Array<{ id: number; name: string; displayName: string }>;
  existingData?: {
    id: number;
    regionId: number;
    avgAcvNew: number;
    avgAcvUpsell: number;
  };
  onSuccess?: () => void;
}

export function EditDealEconomics({ companyId, regions, existingData, onSuccess }: EditDealEconomicsProps) {
  const [open, setOpen] = useState(false);
  const [regionId, setRegionId] = useState(existingData?.regionId?.toString() || "");
  const [avgAcvNew, setAvgAcvNew] = useState(
    existingData ? (existingData.avgAcvNew / 100).toFixed(2) : ""
  );
  const [avgAcvUpsell, setAvgAcvUpsell] = useState(
    existingData ? (existingData.avgAcvUpsell / 100).toFixed(2) : ""
  );

  const utils = trpc.useUtils();
  const upsertMutation = trpc.dealEconomics.upsert.useMutation({
    onSuccess: () => {
      toast.success(existingData ? "Deal economics updated" : "Deal economics added");
      utils.dealEconomics.list.invalidate();
      setOpen(false);
      onSuccess?.();
      
      // Reset form if adding new
      if (!existingData) {
        setRegionId("");
        setAvgAcvNew("");
        setAvgAcvUpsell("");
      }
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!regionId || !avgAcvNew || !avgAcvUpsell) {
      toast.error("Please fill in all fields");
      return;
    }

    upsertMutation.mutate({
      companyId,
      regionId: parseInt(regionId),
      acvNew: Math.round(parseFloat(avgAcvNew) * 100), // Convert to cents
      acvUpsell: Math.round(parseFloat(avgAcvUpsell) * 100),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={existingData ? "ghost" : "default"} size={existingData ? "sm" : "default"}>
          {existingData ? (
            <><Pencil className="h-4 w-4" /></>
          ) : (
            <><Plus className="h-4 w-4 mr-2" /> Add Deal Economics</>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{existingData ? "Edit" : "Add"} Deal Economics</DialogTitle>
            <DialogDescription>
              {existingData ? "Update" : "Set"} average contract values (ACVs) for this region
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
              <Label htmlFor="avgAcvNew" className="text-right">
                Avg ACV (New)
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="avgAcvNew"
                  type="number"
                  step="0.01"
                  value={avgAcvNew}
                  onChange={(e) => setAvgAcvNew(e.target.value)}
                  className="flex-1"
                  min="0"
                  placeholder="e.g., 50000.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="avgAcvUpsell" className="text-right">
                Avg ACV (Upsell)
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="avgAcvUpsell"
                  type="number"
                  step="0.01"
                  value={avgAcvUpsell}
                  onChange={(e) => setAvgAcvUpsell(e.target.value)}
                  className="flex-1"
                  min="0"
                  placeholder="e.g., 75000.00"
                />
              </div>
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
