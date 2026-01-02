import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

interface EditSQLHistoryProps {
  companyId: number;
  regions: Array<{ id: number; name: string; displayName: string }>;
  sqlTypes: Array<{ id: number; name: string; displayName: string }>;
  existingData?: {
    id: number;
    regionId: number;
    sqlTypeId: number;
    year: number;
    quarter: number;
    volume: number;
  };
  onSuccess?: () => void;
}

export function EditSQLHistory({ companyId, regions, sqlTypes, existingData, onSuccess }: EditSQLHistoryProps) {
  const [open, setOpen] = useState(false);
  const [regionId, setRegionId] = useState(existingData?.regionId?.toString() || "");
  const [sqlTypeId, setSqlTypeId] = useState(existingData?.sqlTypeId?.toString() || "");
  const [year, setYear] = useState(existingData?.year?.toString() || new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState(existingData?.quarter?.toString() || "1");
  const [volume, setVolume] = useState(existingData?.volume?.toString() || "");

  const utils = trpc.useUtils();
  const upsertMutation = trpc.sqlHistory.upsert.useMutation({
    onSuccess: () => {
      toast.success(existingData ? "SQL history updated" : "SQL history added");
      utils.sqlHistory.list.invalidate();
      setOpen(false);
      onSuccess?.();
      
      // Reset form if adding new
      if (!existingData) {
        setRegionId("");
        setSqlTypeId("");
        setVolume("");
      }
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!regionId || !sqlTypeId || !year || !quarter || !volume) {
      toast.error("Please fill in all fields");
      return;
    }

    upsertMutation.mutate({
      companyId,
      regionId: parseInt(regionId),
      sqlTypeId: parseInt(sqlTypeId),
      year: parseInt(year),
      quarter: parseInt(quarter),
      volume: parseInt(volume),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={existingData ? "ghost" : "default"} size={existingData ? "sm" : "default"}>
          {existingData ? (
            <><Pencil className="h-4 w-4" /></>
          ) : (
            <><Plus className="h-4 w-4 mr-2" /> Add SQL Data</>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{existingData ? "Edit" : "Add"} SQL History</DialogTitle>
            <DialogDescription>
              {existingData ? "Update" : "Enter"} historical SQL volume data for forecasting
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
              <Label htmlFor="year" className="text-right">
                Year
              </Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="col-span-3"
                min="2020"
                max="2030"
                disabled={!!existingData}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quarter" className="text-right">
                Quarter
              </Label>
              <Select value={quarter} onValueChange={setQuarter} disabled={!!existingData}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="volume" className="text-right">
                SQL Volume
              </Label>
              <Input
                id="volume"
                type="number"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="col-span-3"
                min="0"
                placeholder="e.g., 150"
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
