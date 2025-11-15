import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportCSVProps {
  companyId: number;
  onSuccess?: () => void;
}

export function ImportCSV({ companyId, onSuccess }: ImportCSVProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const utils = trpc.useUtils();
  const importMutation = trpc.sqlHistory.importCSV.useMutation({
    onSuccess: (result) => {
      toast.success(`Successfully imported ${result.imported} SQL records`);
      utils.sqlHistory.list.invalidate();
      setOpen(false);
      setFile(null);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
      setImporting(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setImporting(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("CSV file is empty or invalid");
        setImporting(false);
        return;
      }

      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['region', 'sqltype', 'year', 'quarter', 'volume'];
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(', ')}`);
        setImporting(false);
        return;
      }

      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });

        records.push({
          region: record.region,
          sqlType: record.sqltype,
          year: parseInt(record.year),
          quarter: parseInt(record.quarter),
          volume: parseInt(record.volume),
        });
      }

      importMutation.mutate({
        companyId,
        records,
      });
    } catch (error) {
      toast.error("Failed to parse CSV file");
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `region,sqltype,year,quarter,volume
North America,Inbound,2024,1,50
North America,Outbound,2024,1,30
EMESA North,Inbound,2024,1,25
EMESA South,Partner,2024,1,15`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sql_history_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Template downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import SQL History from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with historical SQL volume data
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              CSV must include columns: <code>region</code>, <code>sqltype</code>, <code>year</code>, <code>quarter</code>, <code>volume</code>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Download CSV Template
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
