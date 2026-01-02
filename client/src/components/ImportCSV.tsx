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

/**
 * ImportCSV Component
 * 
 * Provides a dialog interface for importing SQL history data from CSV files.
 * Supports validation, error reporting, and batch processing of imported records.
 * 
 * @param companyId - The ID of the company to import data for
 * @param onSuccess - Optional callback function called after successful import
 * 
 * @returns A button that opens a dialog for CSV file selection and import
 */
export function ImportCSV({ companyId, onSuccess }: ImportCSVProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const utils = trpc.useUtils();
  const importMutation = trpc.sqlHistory.importCSV.useMutation({
    onSuccess: (result) => {
      if (result.skipped > 0) {
        toast.warning(
          `Imported ${result.imported} records, ${result.skipped} skipped. Check console for details.`,
          { duration: 5000 }
        );
        if (result.skippedRecords.length > 0) {
          console.warn("Skipped records:", result.skippedRecords);
        }
      } else {
        toast.success(`Successfully imported ${result.imported} SQL records`);
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => toast.warning(warning));
      }
      utils.sqlHistory.list.invalidate();
      setImporting(false);
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

      interface ParsedRecord {
        region: string;
        sqlType: string;
        year: number;
        quarter: number;
        volume: number;
      }

      const records: ParsedRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });

        const year = parseInt(record.year || '0', 10);
        const quarter = parseInt(record.quarter || '0', 10);
        const volume = parseInt(record.volume || '0', 10);

        // Skip invalid records
        if (isNaN(year) || isNaN(quarter) || isNaN(volume)) {
          continue;
        }

        records.push({
          region: record.region || '',
          sqlType: record.sqltype || '',
          year,
          quarter,
          volume,
        });
      }

      if (records.length === 0) {
        toast.error("No valid records found in CSV file");
        setImporting(false);
        return;
      }

      importMutation.mutate({
        companyId,
        records,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse CSV file";
      toast.error(message);
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
